import type { INodeProperties } from 'n8n-workflow';

const INSTRUMENTS = [
	'DRUMS',
	'PERCS',
	'HATS',
	'CLAPS',
	'BASS',
	'MIDS',
	'LEADS',
	'FX',
	'VOCALS',
	'PADS',
	'RISER',
	'IMPACT',
].map((value) => ({ name: value.charAt(0) + value.slice(1).toLowerCase(), value }));

const STEMS = [
	{ name: 'Bass', value: 'BASS' },
	{ name: 'Drums (Drums, Percs, Hats, Claps)', value: 'DRUMS' },
	{ name: 'FX (FX, Riser, Impact)', value: 'FX' },
	{ name: 'Leads (Mids, Leads, Pads)', value: 'LEADS' },
	{ name: 'Vocals', value: 'VOCALS' },
];

const KEYS = [
	'C',
	'Cm',
	'C#',
	'C#m',
	'D',
	'Dm',
	'D#',
	'D#m',
	'E',
	'Em',
	'F',
	'Fm',
	'F#',
	'F#m',
	'G',
	'Gm',
	'G#',
	'G#m',
	'A',
	'Am',
	'A#',
	'A#m',
	'B',
	'Bm',
].map((value) => ({ name: value, value }));

const outputOptions = (operations: string[]): INodeProperties[] => [
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		displayOptions: { show: { resource: ['track'], operation: operations } },
		description:
			'Whether to wait until the track is rendered. Generation usually takes 5–30 seconds.',
	},
	{
		displayName: 'Download File',
		name: 'download',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: { resource: ['track'], operation: operations, waitForCompletion: [true] },
		},
		description: 'Whether to download the audio and return it as binary data',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: {
			show: {
				resource: ['track'],
				operation: operations,
				waitForCompletion: [true],
				download: [true],
			},
		},
		hint: 'The name of the output binary field to put the audio in',
	},
];

const waitOptions: INodeProperties = {
	displayName: 'Wait Settings',
	name: 'waitSettings',
	type: 'collection',
	placeholder: 'Add Setting',
	default: {},
	displayOptions: {
		show: {
			resource: ['track'],
			operation: ['generate', 'generateSimilar', 'edit'],
			waitForCompletion: [true],
		},
	},
	options: [
		{
			displayName: 'Poll Interval (Seconds)',
			name: 'pollInterval',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 3,
			description: 'How often to check whether the track is ready',
		},
		{
			displayName: 'Timeout (Seconds)',
			name: 'timeout',
			type: 'number',
			typeOptions: { minValue: 10 },
			default: 300,
			description: 'How long to wait before failing',
		},
	],
};

const audioSettings = (operations: string[], withMode: boolean): INodeProperties => ({
	displayName: 'Additional Fields',
	name: 'additionalFields',
	type: 'collection',
	placeholder: 'Add Field',
	default: {},
	displayOptions: { show: { resource: ['track'], operation: operations } },
	options: [
		{
			displayName: 'Bitrate',
			name: 'bitrate',
			type: 'options',
			options: [32, 96, 128, 192, 256, 320].map((value) => ({
				name: `${value} Kbps`,
				value,
			})),
			default: 128,
			description: 'MP3 bitrate. Allowed values depend on your plan.',
		},
		{
			displayName: 'Format',
			name: 'format',
			type: 'options',
			options: [
				{ name: 'MP3', value: 'mp3' },
				{ name: 'WAV', value: 'wav' },
			],
			default: 'mp3',
		},
		{
			displayName: 'Intensity',
			name: 'intensity',
			type: 'options',
			options: [
				{ name: 'Low', value: 'low' },
				{ name: 'Medium', value: 'medium' },
				{ name: 'High', value: 'high' },
			],
			default: 'high',
			description: 'How dense and energetic the music is. Low works best under a voice-over.',
		},
		...(withMode
			? ([
					{
						displayName: 'Mode',
						name: 'mode',
						type: 'options',
						options: [
							{ name: 'Track', value: 'track', description: 'A full track with intro and outro' },
							{ name: 'Loop', value: 'loop', description: 'A seamless loop' },
							{
								name: 'Jingle',
								value: 'jingle',
								description: 'A short jingle (playlist source only)',
							},
							{
								name: 'Mix',
								value: 'mix',
								description: 'A DJ-style mix of several tracks (playlist source only)',
							},
						],
						default: 'track',
					},
				] as INodeProperties[])
			: []),
	],
});

export const trackOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['track'] } },
		options: [
			{
				name: 'Edit',
				value: 'edit',
				description: 'Create a new version of a track with instruments or stems changed',
				action: 'Edit a track',
			},
			{
				name: 'Generate',
				value: 'generate',
				description: 'Generate a royalty-free track of an exact length',
				action: 'Generate a track',
			},
			{
				name: 'Generate Similar',
				value: 'generateSimilar',
				description: 'Generate a new track similar to an existing one',
				action: 'Generate a similar track',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a track and its download link',
				action: 'Get a track',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many generated tracks',
				action: 'Get many tracks',
			},
		],
		default: 'generate',
	},
];

export const trackFields: INodeProperties[] = [
	// ---------- generate ----------
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['track'], operation: ['generate'] } },
		options: [
			{
				name: 'Text Prompt',
				value: 'prompt',
				description: 'Describe the music in words',
			},
			{
				name: 'Playlist',
				value: 'playlist',
				description: 'Pick a genre, mood or activity channel. Supports BPM and key.',
			},
			{
				name: 'Image',
				value: 'image',
				description: 'Generate music that matches an image from a binary field',
			},
		],
		default: 'prompt',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 2 },
		required: true,
		default: '',
		placeholder: 'e.g. upbeat electronic background for a product video',
		displayOptions: { show: { resource: ['track'], operation: ['generate'], source: ['prompt'] } },
		description: 'What the music should sound like. Up to 255 characters.',
	},
	{
		displayName: 'Playlist Name or ID',
		name: 'playlistIndex',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPlaylists' },
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['track'], operation: ['generate'], source: ['playlist'] },
		},
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. IDs look like "6.4.0" (category.group.channel). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Input Binary Field',
		name: 'imageBinaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: { show: { resource: ['track'], operation: ['generate'], source: ['image'] } },
		hint: 'The name of the input binary field with a PNG, JPG, WEBP or BMP image (50 KB – 10 MB)',
	},
	{
		displayName: 'Duration (Seconds)',
		name: 'duration',
		type: 'number',
		required: true,
		typeOptions: { minValue: 5 },
		default: 30,
		displayOptions: { show: { resource: ['track'], operation: ['generate'] } },
		description:
			'Exact length of the track. Set it to your video length. The maximum depends on your plan.',
	},
	{
		displayName: 'Playlist Options',
		name: 'playlistOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: ['track'], operation: ['generate'], source: ['playlist'] },
		},
		options: [
			{
				displayName: 'BPM',
				name: 'bpm',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 120,
				description: 'Tempo in beats per minute',
			},
			{
				displayName: 'Key',
				name: 'key',
				type: 'options',
				options: KEYS,
				default: 'C',
				description: 'Musical key',
			},
		],
	},
	audioSettings(['generate'], true),

	// ---------- track ID (get, similar, edit) ----------
	{
		displayName: 'Track ID',
		name: 'trackId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['track'], operation: ['get', 'generateSimilar', 'edit'] },
		},
		description: 'The ID of a track generated earlier',
	},

	// ---------- generate similar ----------
	audioSettings(['generateSimilar'], true),
	{
		displayName: 'Duration (Seconds)',
		name: 'similarDuration',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		displayOptions: { show: { resource: ['track'], operation: ['generateSimilar'] } },
		description: 'Length of the new track. Leave 0 to use the original length.',
	},

	// ---------- edit ----------
	{
		displayName: 'Edit Type',
		name: 'editType',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['track'], operation: ['edit'] } },
		options: [
			{ name: 'Change Settings', value: 'settings', description: 'Change duration, intensity or format' },
			{ name: 'Delete Instruments', value: 'deleteInstruments' },
			{ name: 'Delete Stems', value: 'deleteStems' },
			{ name: 'Replace Instruments', value: 'replaceInstruments' },
			{ name: 'Replace Stems', value: 'replaceStems' },
		],
		default: 'deleteStems',
		description:
			'Every edit creates a new track and uses quota. If there is no replacement for an instrument, "replace" removes it.',
	},
	{
		displayName: 'Instrument Names or IDs',
		name: 'instruments',
		type: 'multiOptions',
		options: INSTRUMENTS,
		required: true,
		default: [],
		displayOptions: {
			show: {
				resource: ['track'],
				operation: ['edit'],
				editType: ['deleteInstruments', 'replaceInstruments'],
			},
		},
	},
	{
		displayName: 'Stems',
		name: 'stems',
		type: 'multiOptions',
		options: STEMS,
		required: true,
		default: [],
		displayOptions: {
			show: { resource: ['track'], operation: ['edit'], editType: ['deleteStems', 'replaceStems'] },
		},
	},
	{
		displayName: 'Duration (Seconds)',
		name: 'editDuration',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		displayOptions: { show: { resource: ['track'], operation: ['edit'], editType: ['settings'] } },
		description: 'New length. Leave 0 to keep the current length.',
	},
	audioSettings(['edit'], false),

	// ---------- wait + download (generate, similar, edit, get) ----------
	...outputOptions(['generate', 'generateSimilar', 'edit']),
	waitOptions,
	{
		displayName: 'Download File',
		name: 'downloadOnGet',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['track'], operation: ['get'] } },
		description: 'Whether to download the audio and return it as binary data',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'getBinaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: { show: { resource: ['track'], operation: ['get'], downloadOnGet: [true] } },
		hint: 'The name of the output binary field to put the audio in',
	},

	// ---------- simplify ----------
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		displayOptions: { show: { resource: ['track'] } },
		description: 'Whether to return a simplified version of the response instead of the raw data',
	},

	// ---------- get many ----------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['track'], operation: ['getAll'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: ['track'], operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
];
