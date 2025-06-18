import { useEffect, useState } from 'react';
import { CATALOG_API } from '../api/catalog';
import buildTree from '../utils/buildTree' ;

export const useCatalogTree = (filters = {}) => {
    const [treeData, setTreeData] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        const fetchTree = async () => {
            setLoading(true);
            try {
                const data = await CATALOG_API.fetchFileOptions(filters);
                console.log("API response:", data);
                const tree = buildTree(data);
                console.log("Built tree:", tree);
                setTreeData(tree);
            } catch (error) {
                console.error("Failed to fetch file options:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTree();
    }, [JSON.stringify(filters)]);

  return { treeData, loading };
};
