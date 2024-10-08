import { DsApiData, DsResponse } from '@/types/request.types';

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

/**
 * Parses and formats a fetch API response to a standardized response object.
 * @param {Response} response - The response object from the fetch API.
 * @returns {Promise<DsResponse<T>>} The formatted response object.
 */
async function formatDsResponse<T>(response: Response): Promise<DsResponse<T>> {
  const data = <T & DsApiData>await response.json();

  return {
    status: response.status,
    data,
    ...(data.message && { message: data.message })
  };
}

/**
 * Performs a fetch request and formats the response.
 * @param {string} requestUrl - The URL to send the request to.
 * @param {RequestInit} params - The request parameters.
 * @returns {Promise<DsResponse<T>>} - The response object formatted according to the specified data type.
 * @throws {Error} Throws an error if the fetch response contains a client or server error status.
 */
export async function request<T>(requestUrl: string, params: RequestInit): Promise<DsResponse<T>> {
  const requestParams = {
    ...params,
    signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS)
  };

  const response = await fetch(requestUrl, requestParams);

  const formattedResponse = await formatDsResponse<T>(response);

  if (!response.ok) {
    throw new Error(formattedResponse.message);
  }

  return formattedResponse;
}
