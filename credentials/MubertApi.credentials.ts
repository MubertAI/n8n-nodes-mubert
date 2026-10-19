import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MubertApi implements ICredentialType {
	name = 'mubertApi';

	displayName = 'Mubert API';

	icon: Icon = { light: 'file:mubert.svg', dark: 'file:mubert.dark.svg' };

	documentationUrl = 'https://mubert.com/api/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'Customer ID',
			name: 'customerId',
			type: 'string',
			default: '',
			required: true,
			description: 'The customer ID of your Mubert API user (header "customer-id")',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'The access token of your Mubert API user (header "access-token"). It renews itself while in use and expires after about a month of inactivity.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'customer-id': '={{$credentials.customerId}}',
				'access-token': '={{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://music-api.mubert.com/api/v3',
			url: '/public/playlists',
			method: 'GET',
		},
	};
}
