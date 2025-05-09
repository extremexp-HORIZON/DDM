import axios from 'axios';
import {BASE_URL} from './base';

export const pollTaskResult = async (taskId, intervalMs, timeoutMs) => {
  const start = Date.now();

  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed > timeoutMs) throw new Error("⏰ Task timed out");

    const {data} = await axios.get(`${BASE_URL}/tasks/status/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        }
      }
    );
    const {state, result} = data;

    if (state === "SUCCESS") return result;
    if (state === "FAILURE") throw new Error("❌ Task failed");

    await new Promise(res => setTimeout(res, intervalMs));
  }
};
