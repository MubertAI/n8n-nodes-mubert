import type { INodeProperties } from 'n8n-workflow';

export const playlistOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['playlist'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the genre, mood and activity channels you can generate from',
				action: 'Get many playlists',
			},
		],
		default: 'getAll',
	},
];

export const playlistFields: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		displayOptions: { show: { resource: ['playlist'], operation: ['getAll'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: ['playlist'], operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
];
