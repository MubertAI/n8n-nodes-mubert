import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

export const BASE_URL = 'https://music-api.mubert.com/api/v3';

const USER_AGENT = 'n8n-nodes-mubert/0.1.0';

const PRICING_URL = 'https://mubert.com/api';

export interface MubertGeneration extends IDataObject {
	session_id: string;
	format: string;
	bitrate: number;
	status: string;
	generated_at: string | null;
	expired_at: string | null;
	created_at: string;
	url: string | null;
}

export interface MubertTrack extends IDataObject {
	id: string;
	session_id: string;
	playlist_index: string | null;
	prompt: string | null;
	duration: number;
	intensity: string;
	mode: string;
	bpm: number | null;
	key: string | null;
	generations: MubertGeneration[];
}

// Stable error codes returned by the API, mapped to messages a workflow builder can act on.
const ERROR_HINTS: Record<string, string> = {
	AccessTokenExpired:
		'The access token expired after a long period of inactivity. Ask for a new token or create the customer again.',
	Unauthenticated: 'Customer ID or access token is wrong. Check the Mubert API credential.',
	LicenseExpired: `Your Mubert API license has expired. Renew it at ${PRICING_URL}`,
	LicenseIsNotActive: `Your Mubert API license is not active. See ${PRICING_URL}`,
	LicenseLimitTracksCount: `You have used all tracks in your Mubert plan. Upgrade at ${PRICING_URL}`,
	LicenseLimitTracksDuration: `You have used all track minutes in your Mubert plan. Upgrade at ${PRICING_URL}`,
	LicenseLimitConcurrentTrackGenerationsCount:
		'Too many tracks are being generated at the same time. Wait for running generations to finish.',
	LicenseForbiddenDuration: `This duration is longer than your Mubert plan allows. Upgrade at ${PRICING_URL}`,
	LicenseForbiddenFeature: `This kind of generation is not included in your Mubert plan. Upgrade at ${PRICING_URL}`,
	LicenseForbiddenFormat: 'This audio format is not included in your Mubert plan.',
	LicenseForbiddenBitrate: 'This bitrate is not included in your Mubert plan.',
	LicenseForbiddenMode: 'This mode is not included in your Mubert plan.',
	LicenseForbiddenIntensity: 'This intensity is not included in your Mubert plan.',
	TrackNotFound: 'No track with this ID was found for this customer.',
};

function extractErrorCode(error: JsonObject): string | undefined {
	const candidates = [
		(error.context as JsonObject | undefined)?.data,
		(error.cause as JsonObject | undefined)?.error,
		((error.cause as JsonObject | undefined)?.response as JsonObject | undefined)?.data,
		(error.response as JsonObject | undefined)?.data,
		(error.response as JsonObject | undefined)?.body,
		error.error,
		error.description,
	];
	for (const candidate of candidates) {
		if (candidate && typeof candidate === 'object' && 'code' in candidate) {
			return String((candidate as JsonObject).code);
		}
		if (typeof candidate === 'string') {
			try {
				const parsed = JSON.parse(candidate) as JsonObject;
				if (parsed.code) return String(parsed.code);
			} catch {
				// not JSON, ignore
			}
		}
	}
	return undefined;
}

function extractApiMessage(error: JsonObject): string | undefined {
	const body =
		((error.context as JsonObject | undefined)?.data as JsonObject | undefined) ??
		((error.cause as JsonObject | undefined)?.error as JsonObject | undefined) ??
		(((error.cause as JsonObject | undefined)?.response as JsonObject | undefined)?.data as
			| JsonObject
			| undefined) ??
		((error.response as JsonObject | undefined)?.data as JsonObject | undefined) ??
		((error.response as JsonObject | undefined)?.body as JsonObject | undefined);
	if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
	return undefined;
}

export async function mubertApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${endpoint}`,
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
		json: true,
	};
	if (body && Object.keys(body).length) options.body = body;
	if (qs && Object.keys(qs).length) options.qs = qs;

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'mubertApi',
			options,
		)) as IDataObject;
	} catch (error) {
		const code = extractErrorCode(error as JsonObject);
		const hint = code ? ERROR_HINTS[code] : undefined;
		const apiMessage = extractApiMessage(error as JsonObject);
		// The auth helper already wraps failures in NodeApiError, and the constructor returns an
		// existing NodeApiError unchanged, so set the readable message on the instance itself.
		const apiError =
			error instanceof NodeApiError ? error : new NodeApiError(this.getNode(), error as JsonObject);
		const notFound = !code && String(apiError.httpCode) === '404';
		const message =
			hint ??
			(code
				? `Mubert API error: ${code}`
				: notFound
					? 'Nothing was found with this ID. Check the track ID.'
					: apiMessage);
		if (message) apiError.message = message;
		apiError.description = code
			? `Error code: ${code}${apiMessage ? `. ${apiMessage}` : ''}`
			: (apiError.description ?? null);
		throw apiError;
	}
}

export function latestGeneration(track: MubertTrack): MubertGeneration | undefined {
	const generations = track.generations ?? [];
	if (!generations.length) return undefined;
	return [...generations].sort((a, b) => a.created_at.localeCompare(b.created_at))[
		generations.length - 1
	];
}

export async function getTrack(this: IExecuteFunctions, trackId: string): Promise<MubertTrack> {
	const response = await mubertApiRequest.call(this, 'GET', `/public/tracks/${trackId}`);
	return response.data as MubertTrack;
}

export async function waitForTrack(
	this: IExecuteFunctions,
	track: MubertTrack,
	pollIntervalSeconds: number,
	timeoutSeconds: number,
	itemIndex: number,
): Promise<MubertTrack> {
	const deadline = Date.now() + timeoutSeconds * 1000;
	let current = track;
	// Generation is asynchronous: poll until the newest generation is done or failed.
	while (true) {
		const generation = latestGeneration(current);
		const status = generation?.status;
		if (status === 'done' || status === 'completed') return current;
		if (status === 'failed' || status === 'error') {
			throw new NodeOperationError(this.getNode(), 'Mubert could not generate this track', {
				itemIndex,
				description: `Track ${current.id}, generation status "${status}"`,
			});
		}
		if (Date.now() > deadline) {
			throw new NodeOperationError(
				this.getNode(),
				`The track was not ready after ${timeoutSeconds} seconds`,
				{
					itemIndex,
					description: `Track ${current.id} is still "${status ?? 'unknown'}". Use the "Get" operation later, or raise the timeout.`,
				},
			);
		}
		await sleep(pollIntervalSeconds * 1000);
		current = await getTrack.call(this, current.id);
	}
}

export async function downloadTrack(
	this: IExecuteFunctions,
	track: MubertTrack,
	itemIndex: number,
): Promise<IBinaryData> {
	// The signed download URL is short-lived, so fetch the track again to get a fresh one.
	const fresh = await getTrack.call(this, track.id);
	const generation = latestGeneration(fresh);
	if (!generation?.url) {
		throw new NodeOperationError(this.getNode(), 'The track has no downloadable file yet', {
			itemIndex,
			description: `Track ${track.id}, generation status "${generation?.status ?? 'unknown'}"`,
		});
	}
	const data = (await this.helpers.httpRequest({
		method: 'GET',
		url: generation.url,
		encoding: 'arraybuffer',
		headers: { 'User-Agent': USER_AGENT },
	})) as ArrayBuffer;
	const extension = generation.format === 'wav' ? 'wav' : 'mp3';
	return await this.helpers.prepareBinaryData(
		Buffer.from(data),
		`mubert-${track.id}.${extension}`,
		extension === 'wav' ? 'audio/wav' : 'audio/mpeg',
	);
}

export function simplifyTrack(track: MubertTrack): IDataObject {
	const generation = latestGeneration(track);
	return {
		id: track.id,
		status: generation?.status,
		prompt: track.prompt,
		playlistIndex: track.playlist_index,
		duration: track.duration,
		mode: track.mode,
		intensity: track.intensity,
		bpm: track.bpm,
		key: track.key,
		format: generation?.format,
		bitrate: generation?.bitrate,
		url: generation?.url,
		urlExpiresAt: generation?.expired_at,
		sessionId: generation?.session_id ?? track.session_id,
	};
}
