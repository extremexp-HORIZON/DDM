import React, { useState } from 'react';
import { QueryBuilderDnD } from '@react-querybuilder/dnd';
import * as ReactDnD from 'react-dnd';
import * as ReactDndHtml5Backend from 'react-dnd-html5-backend';
import { defaultValidator, QueryBuilder } from 'react-querybuilder';
import { fields } from '../constants/fields';
import 'react-querybuilder/dist/query-builder.css';
import "../styles/components/querybuilder.css";
import { QueryBuilderFluent } from '@react-querybuilder/fluent';
import { FluentProvider, webLightTheme, webDarkTheme, Button } from '@fluentui/react-components';
import { useTheme } from "../context/ThemeContext"; 
import { formatQuery } from 'react-querybuilder';
import { POLICIES_API } from '../api/policies';
const initialQuery = { rules: [] };

const SetPolicies = () => {
  const { isDarkMode } = useTheme(); // Get theme from context
  const [query, setQuery] = useState(initialQuery);

  const handlePostPolicy = async () => {
    try {
      const data = await POLICIES_API.postPolicy(query);
      console.log('Policy saved:', data.message);
    } catch (error) {
      console.error('Error saving policy:', error);
    }
  };

  return (
    <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
      <div className={`set-policies-container ${isDarkMode ? 'dark-theme' : ''}`}>
        <h2>Set Policies</h2>
        
        {/* Query Builder with Fluent UI & Drag and Drop */}
        <QueryBuilderDnD dnd={{ ...ReactDnD, ...ReactDndHtml5Backend }}>
          <QueryBuilderFluent>
            <QueryBuilder
              fields={fields}
              query={query}
              onQueryChange={setQuery}
              debugMode
              parseNumbers="strict-limited"
              resetOnOperatorChange
              showCloneButtons
              showNotToggle
              showDragHandle
              validator={defaultValidator}
              controlClassnames={{ queryBuilder: 'queryBuilder-branches justifiedLayout' }}
            />
          </QueryBuilderFluent>
        </QueryBuilderDnD>

        {/* Button Container */}
        <div className="button-container">
          <Button appearance="primary" className="btn btn-outline-primary m-2" onClick={handlePostPolicy}>Save Policy</Button>
          <Button appearance="secondary" className="btn btn-outline-secondary" onClick={() => console.log(formatQuery(query, 'json_without_ids'))}>Log Query</Button>
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 italic">
          🚧 Under construction — more features coming soon!
        </p>
      </div>
    </FluentProvider>
  );
};

export default SetPolicies;
