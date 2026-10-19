import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	connection,
	downloadTrack,
	getTrack,
	mubertApiRequest,
	routePath,
	simplifyTrack,
	waitForTrack,
	type MubertTrack,
} from './GenericFunctions';
import {
	accountFields,
	accountOperations,
	DEFAULT_GATEWAY_URL,
} from './descriptions/AccountDescription';
import { playlistFields, playlistOperations } from './descriptions/PlaylistDescription';
import { trackFields, trackOperations } from './descriptions/TrackDescription';

const PROMPT_MAX_LENGTH = 255;

export class Mubert implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mubert',
		name: 'mubert',
		icon: { light: 'file:mubert.svg', dark: 'file:mubert.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Generate royalty-free music of an exact length for videos, apps and games with Mubert',
		defaults: { name: 'Mubert' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mubertKeyApi',
				required: true,
				displayOptions: {
					show: { authentication: ['apiKey'] },
					hide: { operation: ['getFreeKey'] },
				},
			},
			{
				name: 'mubertApi',
				required: true,
				displayOptions: {
					show: { authentication: ['customerToken'] },
					hide: { operation: ['getFreeKey'] },
				},
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{ name: 'Mubert API Key', value: 'apiKey' },
					{ name: 'Customer ID and Access Token', value: 'customerToken' },
				],
				default: 'apiKey',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Playlist', value: 'playlist' },
					{ name: 'Track', value: 'track' },
				],
				default: 'track',
			},
			...accountOperations,
			...accountFields,
			...trackOperations,
			...trackFields,
			...playlistOperations,
			...playlistFields,
		],
	};

	methods = {
		loadOptions: {
			async getPlaylists(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await mubertApiRequest.call(this, 'GET', '/public/playlists');
				const playlists = (response.data as IDataObject[]) ?? [];
				return playlists
					.map((playlist) => ({
						name: `${playlist.category} / ${playlist.group} / ${playlist.channel}`,
						value: playlist.playlist_index as string,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'account' && operation === 'getFreeKey') {
					const email = (this.getNodeParameter('email', i) as string).trim();
					const options = this.getNodeParameter('freeKeyOptions', i, {}) as IDataObject;
					const baseUrl = String(options.baseUrl || DEFAULT_GATEWAY_URL).replace(/\/$/, '');
					let response: IDataObject;
					try {
						response = (await this.helpers.httpRequest({
							method: 'POST',
							url: `${baseUrl}/v1/trial`,
							body: { email, source: 'n8n', instance_id: this.getInstanceId() },
							json: true,
						})) as IDataObject;
					} catch (error) {
						const body = ((error as JsonObject).response as JsonObject | undefined)?.body as
							| JsonObject
							| undefined;
						const gatewayError = body?.error as JsonObject | undefined;
						throw new NodeApiError(this.getNode(), error as JsonObject, {
							message: (gatewayError?.message as string) ?? 'Could not get a free key',
							description: (gatewayError?.guidance as string) ?? undefined,
						});
					}
					returnData.push({
						json: {
							...response,
							next_step:
								'Create a "Mubert Automation API" credential and paste api_key into it. Then set Authentication to "Mubert API Key".',
						},
						pairedItem: { item: i },
					});
					continue;
				}

				if (resource === 'account' && operation === 'getUpgradeLink') {
					if (this.getNodeParameter('authentication', i) !== 'apiKey') {
						throw new NodeOperationError(
							this.getNode(),
							'Upgrade links work with a Mubert API key',
							{
								itemIndex: i,
								description: 'Plans for direct API customers: https://mubert.com/api',
							},
						);
					}
					const response = await mubertApiRequest.call(this, 'GET', '/v1/upgrade');
					returnData.push({ json: response.data as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'account' && operation === 'getUsage') {
					if (this.getNodeParameter('authentication', i) !== 'apiKey') {
						throw new NodeOperationError(
							this.getNode(),
							'Usage is available with a Mubert API key',
							{ itemIndex: i, description: 'Set Authentication to "Mubert API Key"' },
						);
					}
					const response = await mubertApiRequest.call(this, 'GET', '/v1/me');
					returnData.push({ json: response.data as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'playlist' && operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const response = await mubertApiRequest.call(this, 'GET', '/public/playlists');
					let playlists = (response.data as IDataObject[]) ?? [];
					if (!returnAll) {
						const limit = this.getNodeParameter('limit', i) as number;
						playlists = playlists.slice(0, limit);
					}
					for (const playlist of playlists) {
						returnData.push({ json: playlist, pairedItem: { item: i } });
					}
					continue;
				}

				if (resource !== 'track') {
					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
						itemIndex: i,
					});
				}

				const simplify = this.getNodeParameter('simplify', i) as boolean;

				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
					const pageSize = 100;
					let offset = 0;
					const tracks: MubertTrack[] = [];
					while (tracks.length < limit) {
						const response = await mubertApiRequest.call(this, 'GET', '/public/tracks', undefined, {
							limit: Math.min(pageSize, limit - tracks.length),
							offset,
						});
						const page = (response.data as MubertTrack[]) ?? [];
						tracks.push(...page);
						const total = ((response.meta as IDataObject | undefined)?.total as number) ?? 0;
						offset += page.length;
						if (!page.length || offset >= total) break;
					}
					for (const track of tracks) {
						returnData.push({
							json: simplify ? simplifyTrack(track) : track,
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (operation === 'get') {
					const trackId = this.getNodeParameter('trackId', i) as string;
					const track = await getTrack.call(this, trackId);
					const item: INodeExecutionData = {
						json: simplify ? simplifyTrack(track) : track,
						pairedItem: { item: i },
					};
					if (this.getNodeParameter('downloadOnGet', i) as boolean) {
						const property = this.getNodeParameter('getBinaryPropertyName', i) as string;
						item.binary = { [property]: await downloadTrack.call(this, track, i) };
					}
					returnData.push(item);
					continue;
				}

				let track: MubertTrack;

				if (operation === 'generate') {
					track = await generate.call(this, i);
				} else if (operation === 'generateSimilar') {
					const trackId = this.getNodeParameter('trackId', i) as string;
					const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
					const duration = this.getNodeParameter('similarDuration', i, 0) as number;
					// Keep the original track's settings unless the user overrides them.
					// The API requires a duration here, so it always comes from somewhere.
					const original = await getTrack.call(this, trackId);
					const body: IDataObject = {
						intensity: original.intensity,
						mode: original.mode,
						...additional,
						duration: duration > 0 ? duration : original.duration,
					};
					const response = await mubertApiRequest.call(
						this,
						'POST',
						`/public/tracks/${trackId}/similar`,
						body,
					);
					track = response.data as MubertTrack;
				} else if (operation === 'edit') {
					const trackId = this.getNodeParameter('trackId', i) as string;
					const editType = this.getNodeParameter('editType', i) as string;
					const body: IDataObject = {};
					if (editType === 'settings') {
						const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
						Object.assign(body, additional);
						const duration = this.getNodeParameter('editDuration', i, 0) as number;
						if (duration > 0) body.duration = duration;
						if (!Object.keys(body).length) {
							throw new NodeOperationError(this.getNode(), 'Nothing to change', {
								itemIndex: i,
								description: 'Set a duration or add at least one field to change',
							});
						}
					} else {
						const field = {
							deleteInstruments: 'delete_instruments',
							replaceInstruments: 'replace_instruments',
							deleteStems: 'delete_stems',
							replaceStems: 'replace_stems',
						}[editType] as string;
						const values = this.getNodeParameter(
							editType.endsWith('Stems') ? 'stems' : 'instruments',
							i,
						) as string[];
						if (!values.length) {
							throw new NodeOperationError(this.getNode(), 'Choose at least one value to edit', {
								itemIndex: i,
							});
						}
						body[field] = values;
					}
					const response = await mubertApiRequest.call(
						this,
						'POST',
						`/public/tracks/${trackId}/edit`,
						body,
					);
					track = response.data as MubertTrack;
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
						itemIndex: i,
					});
				}

				const plan = track.plan as IDataObject | undefined;
				const item: INodeExecutionData = { json: {}, pairedItem: { item: i } };
				if (this.getNodeParameter('waitForCompletion', i) as boolean) {
					const waitSettings = this.getNodeParameter('waitSettings', i, {}) as IDataObject;
					track = await waitForTrack.call(
						this,
						track,
						(waitSettings.pollInterval as number) ?? 3,
						(waitSettings.timeout as number) ?? 300,
						i,
					);
					if (this.getNodeParameter('download', i) as boolean) {
						const property = this.getNodeParameter('binaryPropertyName', i) as string;
						item.binary = { [property]: await downloadTrack.call(this, track, i) };
					}
				}
				item.json = simplify ? simplifyTrack(track) : track;
				if (plan) item.json.plan = plan;
				returnData.push(item);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				const nodeError = error as NodeOperationError;
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
					message: nodeError.message,
					description: nodeError.description ?? undefined,
				});
			}
		}

		return [returnData];
	}
}

async function generate(this: IExecuteFunctions, i: number): Promise<MubertTrack> {
	const source = this.getNodeParameter('source', i) as string;
	const duration = this.getNodeParameter('duration', i) as number;
	const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	if (source === 'image') {
		return await generateFromImage.call(this, i, duration, additional);
	}

	const body: IDataObject = { duration, ...additional };
	if (source === 'useCase') {
		const conn = await connection.call(this);
		if (!conn.gateway) {
			throw new NodeOperationError(this.getNode(), 'Describe Use Case needs a Mubert API key', {
				itemIndex: i,
				description:
					'Set Authentication to "Mubert API Key", or use the Text Prompt or Playlist source.',
			});
		}
		const useCase = (this.getNodeParameter('useCase', i) as string).trim();
		if (!useCase) {
			throw new NodeOperationError(this.getNode(), 'Describe what the music is for', {
				itemIndex: i,
			});
		}
		body.use_case = useCase;
		body.voiceover = this.getNodeParameter('voiceover', i, false) as boolean;
		const response = await mubertApiRequest.call(this, 'POST', '/public/tracks', body);
		const track = response.data as MubertTrack;
		if (response.plan) track.plan = response.plan;
		return track;
	}
	if (source === 'prompt') {
		const prompt = (this.getNodeParameter('prompt', i) as string).trim();
		if (!prompt) {
			throw new NodeOperationError(this.getNode(), 'The prompt is empty', { itemIndex: i });
		}
		if (prompt.length > PROMPT_MAX_LENGTH) {
			throw new NodeOperationError(
				this.getNode(),
				`The prompt is longer than ${PROMPT_MAX_LENGTH} characters`,
				{ itemIndex: i },
			);
		}
		if (body.mode === 'jingle' || body.mode === 'mix') {
			throw new NodeOperationError(
				this.getNode(),
				`Mode "${body.mode}" works only with the Playlist source`,
				{ itemIndex: i },
			);
		}
		body.prompt = prompt;
	} else {
		body.playlist_index = this.getNodeParameter('playlistIndex', i) as string;
		const playlistOptions = this.getNodeParameter('playlistOptions', i, {}) as IDataObject;
		Object.assign(body, playlistOptions);
	}

	// Always a fresh render: the direct API uses /record to skip the pre-rendered track store;
	// the gateway does the same behind /v1/tracks.
	const conn = await connection.call(this);
	const endpoint = conn.gateway ? '/public/tracks' : '/public/tracks/record';
	const response = await mubertApiRequest.call(this, 'POST', endpoint, body);
	return response.data as MubertTrack;
}

async function generateFromImage(
	this: IExecuteFunctions,
	i: number,
	duration: number,
	additional: IDataObject,
): Promise<MubertTrack> {
	const property = this.getNodeParameter('imageBinaryPropertyName', i) as string;
	const binary = this.helpers.assertBinaryData(i, property);
	const buffer = await this.helpers.getBinaryDataBuffer(i, property);
	if (additional.mode === 'jingle' || additional.mode === 'mix') {
		throw new NodeOperationError(
			this.getNode(),
			`Mode "${additional.mode}" works only with the Playlist source`,
			{ itemIndex: i },
		);
	}

	// Build multipart/form-data by hand to keep the package free of runtime dependencies.
	const boundary = `----n8nMubert${Date.now().toString(16)}`;
	const parts: Buffer[] = [];
	const fields: IDataObject = { duration, ...additional };
	for (const [name, value] of Object.entries(fields)) {
		parts.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`,
			),
		);
	}
	const fileName = binary.fileName ?? 'image.png';
	const mimeType = binary.mimeType ?? 'image/png';
	parts.push(
		Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
		),
		buffer,
		Buffer.from(`\r\n--${boundary}--\r\n`),
	);

	const conn = await connection.call(this);
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, conn.credential, {
		method: 'POST',
		url: `${conn.baseUrl}${routePath(conn, '/public/tracks')}`,
		headers: {
			'Content-Type': `multipart/form-data; boundary=${boundary}`,
			Accept: 'application/json',
		},
		body: Buffer.concat(parts),
		json: false,
	})) as string | IDataObject;
	const parsed = (typeof response === 'string' ? JSON.parse(response) : response) as IDataObject;
	return parsed.data as MubertTrack;
}
