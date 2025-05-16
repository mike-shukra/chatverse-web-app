import { authenticatedFetch } from './authService';

const API_BASE_URL = 'http://chatverse.local:8888/api/v1';

/**
 * Fetches the current user's contact list.
 * @returns {Promise<Array<import('../types').ContactResponseDto>>}
 */
export const fetchContacts = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/contacts`, {
      method: 'GET',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Error fetching contacts: ${response.status}` }));
      throw new Error(errorData.message || `Error fetching contacts: ${response.status}`);
    }
    return await response.json(); // Expects ContactResponseDto[]
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    throw error;
  }
};

/**
 * Sends a contact request to another user.
 * @param {number|string} targetUserId - The ID of the user to send the request to.
 * @returns {Promise<Response>}
 */
export const sendContactRequest = async (targetUserId) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/contacts/requests`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId: Number(targetUserId) }),
    });
    if (!response.ok) { // Expects 201 for success, but authenticatedFetch might not handle 201 as "ok" by default for .json()
      if (response.status === 201) return response; // Success
      const errorData = await response.json().catch(() => ({ message: `Error sending contact request: ${response.status}` }));
      throw new Error(errorData.message || `Error sending contact request: ${response.status}`);
    }
    return response; // Or response.json() if backend returns data on 201/200
  } catch (error) {
    console.error('Failed to send contact request:', error);
    throw error;
  }
};

/**
 * Updates the status of a contact request.
 * @param {number|string} requesterId - The ID of the user who sent the request.
 * @param {"ACCEPTED" | "DECLINED"} newStatus - The new status for the request.
 * @returns {Promise<Response>}
 */
export const updateContactRequestStatus = async (requesterId, newStatus) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/contacts/requests/${requesterId}`, {
      method: 'PUT',
      body: JSON.stringify({ newStatus }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Error updating contact request: ${response.status}` }));
      throw new Error(errorData.message || `Error updating contact request: ${response.status}`);
    }
    return response; // Or response.json() if backend returns data
  } catch (error) {
    console.error('Failed to update contact request status:', error);
    throw error;
  }
};

/**
 * Fetches pending contact requests.
 * @param {"INCOMING" | "OUTGOING"} direction - The direction of requests to fetch.
 * @returns {Promise<Array<import('../types').PendingRequestResponseDto>>}
 */
export const fetchPendingRequests = async (direction = 'INCOMING') => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/contacts/requests/pending?direction=${direction}`, {
      method: 'GET',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Error fetching pending requests: ${response.status}` }));
      throw new Error(errorData.message || `Error fetching pending requests: ${response.status}`);
    }
    return await response.json(); // Expects PendingRequestResponseDto[]
  } catch (error) {
    console.error('Failed to fetch pending requests:', error);
    throw error;
  }
};

/**
 * Removes a contact from the user's contact list.
 * @param {number|string} contactUserId - The ID of the contact to remove.
 * @returns {Promise<Response>}
 */
export const removeContact = async (contactUserId) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/contacts/${contactUserId}`, {
      method: 'DELETE',
    });
    // DELETE often returns 204 No Content, which is !response.ok if .json() is attempted by authenticatedFetch
    if (response.status === 204) return response; // Success
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Error removing contact: ${response.status}` }));
        throw new Error(errorData.message || `Error removing contact: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error('Failed to remove contact:', error);
    throw error;
  }
};

// Определения типов можно вынести в отдельный файл types.js или d.ts
// interface ContactResponseDto { userId: number; username: string; name: string; online: boolean; lastSeen: string; friendshipStatus: string; becameContactsAt: string; }
// interface PendingRequestResponseDto { contactEntityId: number; otherUserId: number; otherUserUsername: string; otherUserName: string; requestStatus: string; direction: string; requestTimestamp: string; }