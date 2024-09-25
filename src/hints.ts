import vdf from 'fast-vdf';
import { bstr } from 'crc-32';

export function crc(text: string): number {
	return bstr(text.toLowerCase()) >>> 0;
}

export function parseCaptionsTextAsHint(text: string): Map<number, string> {
	const root = vdf.parse(text);
	const out = new Map();
	const tokens = root.dir('lang').dir('Tokens').all();
	tokens.map(x => {
		out.set(bstr(x.key.toLowerCase()) >>> 0, x.key);
		out.set(bstr(x.key) >>> 0, x.key);
	});
	return out;
}

export function parseArrayAsHint(arr: string[]): Map<number, string> {
	const out = new Map<number, string>();
	for (let i=0; i<arr.length; i++) out.set(crc(arr[i]), arr[i]);
	return out;
}
