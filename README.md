# vccd
A Typescript library for compiling and decompiling Source Engine caption files.

### Compiling

```ts
import { readFile, writeFile } from "fs/promises";
import { Language, parseArrayAsHint } from "vccd";

// A Map object can also be provided, which allows 32-bit crc hashes
// to be provided directly instead of calculated.
const cc_english = new Language({
	"PORTAL2_Sunday":      "Sunday",
	"PORTAL2_Monday":      "Monday",
	"PORTAL2_Tuesday":     "Tuesday",
	"PORTAL2_Wednesday":   "Wednesday",
	"PORTAL2_Thursday":    "Thursday",
	"PORTAL2_Friday":      "Friday",
	"PORTAL2_Saturday":    "Saturday",
});

// You can also provide the contents of a captions .txt file
// instead of creating the tokens programatically.
const cc_french = Language.parse(`
	"lang"
	{
		"Language"	"french"
		"Tokens"
		{
			"PORTAL2_Sunday"	"dimanche"
			"PORTAL2_Monday"	"lundi"
			"PORTAL2_Tuesday"	"mardi"
			"PORTAL2_Wednesday"	"mercredi"
			"PORTAL2_Thursday"	"jeudi"
			"PORTAL2_Friday"	"vendredi"
		}
	}
`);

// Compile and save!
const buffer_en = cc_english.compile();
const buffer_fr = cc_french.compile();
await writeFile('./test_english.dat', Buffer.from(buffer_en));
await writeFile('./test_french.dat', Buffer.from(buffer_fr));
```

### Decompiling
```ts
const nodeBuffer = await readFile("./test_english.dat");

// For the keys that we know the names of, we can feed them into the hints argument
// to allow the keys hashes to be looked up and replaced with the original text.
// This is optional, but usually quite helpful to have!
const hints = [
	parseArrayAsHint(["PORTAL2_Monday", "PORTAL2_Tuesday"])
];

// Decompile and print what we find!
const cc_english = Language.decompile(nodeBuffer.buffer, hints);
console.log(cc_english.tokens);
// Map(7) {
//   2135313201: "Sunday",
//   "PORTAL2_Monday": "Monday",
//   "PORTAL2_Tuesday": "Tuesday",
//   4072312456: "Wednesday",
//   1462151735: "Thursday",
//   61488304: "Friday",
//   163286573: "Saturday",
// }
```