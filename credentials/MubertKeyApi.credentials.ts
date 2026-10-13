import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MubertKeyApi implements ICredentialType {
	name = 'mubertKeyApi';

	displayName = 'Mubert Automation API';

	icon: Icon = { light: 'file:mubert.svg', dark: 'file:mubert.dark.svg' };

	documentationUrl = 'https://github.com/MubertAI/n8n-nodes-mubert?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'mk_...',
			description:
				'Your Mubert API key. No key yet? Add a Mubert node, choose Account → Get Free Key, run it, and paste the key here. Need more tracks? Run Account → Get Upgrade Link, or see <a href="https://mubert.com/api" target="_blank">mubert.com/api</a>.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://automation.mubert.com',
			description: 'Leave as is unless Mubert support asks you to change it',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/me',
			method: 'GET',
		},
	};
}
