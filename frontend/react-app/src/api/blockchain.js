// src/api/blockchain.js
import axios from "axios";
import { BASE_URL, defaultHeaders } from "./base";

export const BLOCKCHAIN_API = {
    getContracts: (params, config = {}) =>
        axios.get(`${BASE_URL}/blockchain/contracts`, {
            params,
            headers: {
                "Content-Type": "application/json" ,
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    getContractEvents: (address, params, config = {}) =>
        axios.get(`${BASE_URL}/blockchain/contracts/${encodeURIComponent(address)}/events`, {
            params,
            headers: {
                "Content-Type": "application/json" ,
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    getAllEvents: (params, config = {}) =>
        axios.get(`${BASE_URL}/blockchain/events`, {
            params,
            headers: {
                "Content-Type": "application/json" ,
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),
    getRegistry: (params = {}) =>
        axios.get(`${BASE_URL}/blockchain/contracts/registry`, {
            params,
            headers: {
                "Content-Type": "application/json" ,
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    prepareSuite: (payload, config = {}) =>
        axios.post(`${BASE_URL}/blockchain/suites/prepare`, payload, {
            headers: {
                "Content-Type": "application/json" ,
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    prepareRewardClaim: (payload, config = {}) =>
        axios.post(`${BASE_URL}/blockchain/rewards/prepare`, payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
    }),

    prepareValidationResult: (payload, config = {}) =>
        axios.post(`${BASE_URL}/blockchain/validations/prepare`, payload, {
            headers: {
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),


    getContractByAddress: (address, params = {}, config = {}) =>
        axios.get(`${BASE_URL}/blockchain/contracts/${encodeURIComponent(address)}`, {
            params,
            headers: {
                "Content-Type": "application/json" ,
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),
    
    ingestTx: (payload, config = {}) =>
        axios.post(`${BASE_URL}/blockchain/ingest-tx`, payload, {
            headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    getTxs: (params = {}) =>
        axios.get(`${BASE_URL}/blockchain/txs`, {
            params,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    getContractTxs: (address, params = {}) =>
        axios.get(`${BASE_URL}/blockchain/contracts/${encodeURIComponent(address)}/txs`, {
            params,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    getTxByHash: (txHash) =>
        axios.get(`${BASE_URL}/blockchain/txs/${encodeURIComponent(txHash)}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
            },
        }),

    prepareReportIPFSURI: async ({ network, catalog_id, include_report }) => {
        const response = await axios.post(
            `${BASE_URL}/blockchain/register_datasets/prepare_report`,
            {
                network,
                catalog_id,
                include_report, // <= match backend
            },
            {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            }
        );
        return response.data; // { task_id }
        },

        
};
