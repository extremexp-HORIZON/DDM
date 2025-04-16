// src/api/policies.js

import { BASE_URL, defaultHeaders } from './base';

export const POLICIES_API = {
  postPolicy: async (query) => {
    const response = await fetch(`${BASE_URL}/policies/`, {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  },
};
