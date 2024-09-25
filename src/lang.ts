import { ViewBuffer } from 'stupid-buffer';
import { bstr } from 'crc-32';
import vdf from 'fast-vdf';

/** Encodes a string to a Uint16Array and appends a trailing null character. */
export function encode_str16(str: string): Uint16Array {
	const arr = new Uint16Array(str.length + 1);
	for (let i=0; i<str.length; i++) {
		arr[i] = str.charCodeAt(i);
	}
	return arr;
}

/** Decodes a Uint16Array to a string. If a null byte is present, the string will be trimmed. */
export function decode_str16(arr: Uint16Array): string {
	let z_index = arr.indexOf(0);
	if (z_index === -1) z_index = arr.length;
	const trimmed = new Uint16Array(arr.buffer, arr.byteOffset, z_index);
	return String.fromCharCode.apply(null, <number[]><unknown>trimmed);
}

const HEADER_SIZE = 24;
const DIRECTORY_ENTRY_SIZE = 4+4+2+2;
const BLOCK_SIZE = 8192;

/** Defines a Source Engine captions language. */
export class Language {
	public name: string | undefined;
	public readonly tokens: Map<string|number, string> = new Map();

	constructor(tokens: Map<string|number, string> | Record<string, string>, name?: string) {
		if (!tokens) throw TypeError('Expected Map or dictionary for tokens!');
		if (!(tokens instanceof Map))
			tokens = new Map(Object.entries(tokens));
		this.tokens = tokens;
		this.name = name;
	}

	/** Compiles this Language into a captions binary (.dat) file. */
	compile(): ArrayBuffer {
		// Header length is padded to the next 512
		const header_length = Math.ceil((HEADER_SIZE + this.tokens.size * DIRECTORY_ENTRY_SIZE) / 512) * 512;
		const header = new ViewBuffer(header_length);
		header.set_endian(true);
		
		// #region Header
		
		// VCCD <version>
		header.write_str('VCCD', 4);
		header.write_i32(1);
		
		// The number of blocks present in the file
		const header_block_count_pos = header.pointer;
		header.pad(4);

		// Block size, directory size, body data offset
		header.write_i32(BLOCK_SIZE);
		header.write_i32(this.tokens.size);
		header.write_i32(header_length);
		
		// #endregion
		// #region Blocks
		
		let block: ViewBuffer|null = null;
		const blocks: Uint8Array[] = [];

		for (let [key, value] of this.tokens) {
			
			// CRC the key if not done already
			if (typeof key === 'string') {
				key = bstr(key.toLowerCase()) >>> 0;
			}

			// Encode the value
			const str16 = encode_str16(value);
			const str16_length = str16.length * 2;
			
			// If necessary, move on to the next block
			if (!block || block.pointer + str16_length >= block.length) {
				block = new ViewBuffer(BLOCK_SIZE);
				block.set_endian(true);
				blocks.push(block);
			}

			const block_num = blocks.length - 1;
			const str16_offset = block.pointer;

			// Write to block
			block.write_u16(str16);

			// Append to directory
			header.write_u32(key);
			header.write_u32(block_num);
			header.write_u16(str16_offset);
			header.write_u16(str16_length);
		}

		// #endregion

		// #region Wrap-up

		header.seek(header_block_count_pos);
		header.write_i32(blocks.length);

		const file_length = header_length + BLOCK_SIZE * blocks.length;
		const file = new ViewBuffer(file_length);

		file.write_u8(header);
		for (const block of blocks) { file.write_u8(block);}

		// #endregion

		return file.buffer;
	}

	/** Decompiles a captions binary (.dat) file to a Language. */
	static decompile(data: ArrayBuffer, hints: Map<number, string>[]=[], name?: string): Language {
		// Header length is padded to the next 512
		const file = new ViewBuffer(data);
		file.set_endian(true);
		
		// #region Header
		
		// VCCD <version>
		if (file.read_str(4) !== 'VCCD') throw TypeError('Did not match VCCD magic!');
		const version = file.read_i32();
		if (version !== 1) throw TypeError(`Did not match version 1! (${version})`);
		
		// The number of blocks present in the file
		const block_count = file.read_i32();

		// Block size, directory size, body data offset
		const block_size       = file.read_i32();
		const directory_length = file.read_i32();
		const header_length    = file.read_i32();
		
		// #endregion
		// #region Blocks
		
		const seeker = new ViewBuffer(data);
		seeker.set_endian(true);
		const tokens = new Map<string|number, string>();

		function tryDecode(value: number): string|number {
			for (const hint of hints) {
				const v = hint.get(value);
				if (v !== undefined) return v;
			}
			return value;
		}
		
		for (let i=0; i<directory_length; i++) {
			const crc           = file.read_u32();
			const block_num     = file.read_u32();
			const block_offset  = file.read_u16();
			const str_length    = file.read_u16();

			const file_offset = block_num * block_size + header_length + block_offset;
			seeker.seek(file_offset);
			const str16 = seeker.read_u16(str_length);
			const str = decode_str16(str16);
			tokens.set(tryDecode(crc), str);
		}

		// #endregion

		return new Language(tokens, name);
	}

	/** Parses a captions text file (.txt) to a Language. */
	static parse(text: string): Language {
		const root = vdf.parse(text);
		const lang = root.dir('lang')
		const name = lang.value('language', null) ?? undefined;
		
		const tokens = lang.dir('tokens').all();
		const out = new Map();

		for (const token of tokens) {
			if (token instanceof vdf.KeyVSet) continue;
			out.set(token.key, token.value);
		}

		return new Language(out, name);
	}
}
