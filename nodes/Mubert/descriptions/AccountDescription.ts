import type { INodeProperties } from 'n8n-workflow';

export const DEFAULT_GATEWAY_URL = 'https://automation.mubert.com';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Free Key',
				value: 'getFreeKey',
				description:
					'Get a free Mubert API key with a few free tracks, valid for 7 days. No credential needed.',
				action: 'Get a free API key',
			},
			{
				name: 'Get Upgrade Link',
				value: 'getUpgradeLink',
				description: 'Get a link to buy more tracks for your Mubert API key',
				action: 'Get an upgrade link',
			},
			{
				name: 'Get Usage',
				value: 'getUsage',
				description: 'See your plan and how many tracks are left',
				action: 'Get usage',
			},
		],
		default: 'getFreeKey',
	},
];

export const accountFields: INodeProperties[] = [
	{
		displayName:
			'A free key includes a few tracks. Need more? Run <b>Get Upgrade Link</b> or visit <a href="https://mubert.com/api" target="_blank">mubert.com/api</a>.',
		name: 'upgradeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['account'], operation: ['getUsage', 'getUpgradeLink'] } },
	},
	{
		displayName:
			'Run this node once, copy <b>api_key</b> from the output and paste it into a new "Mubert Automation API" credential.',
		name: 'freeKeyNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['account'], operation: ['getFreeKey'] } },
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['account'], operation: ['getFreeKey'] } },
		description: 'Your email. One free key per email.',
	},
	{
		displayName: 'Options',
		name: 'freeKeyOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['account'], operation: ['getFreeKey'] } },
		options: [
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: DEFAULT_GATEWAY_URL,
				description: 'Leave as is unless Mubert support asks you to change it',
			},
		],
	},
];
