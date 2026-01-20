import React, { useEffect, useMemo, useState } from 'react';
import { QueryBuilderDnD } from '@react-querybuilder/dnd';
import * as ReactDnD from 'react-dnd';
import * as ReactDndHtml5Backend from 'react-dnd-html5-backend';
import { defaultValidator, QueryBuilder } from 'react-querybuilder';
import { getAbacFields } from '../constants/fields';
import 'react-querybuilder/dist/query-builder.css';
import '../styles/components/querybuilder.css';


import { QueryBuilderFluent } from '@react-querybuilder/fluent';
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Button,
  Input,
  Field,
  Spinner,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Textarea,
  Text,
} from '@fluentui/react-components';
import { useTheme } from '../context/ThemeContext';

import { formatQuery } from 'react-querybuilder';
import { POLICIES_API } from '../api/policies';
import { CATALOG_API } from '../api/catalog';

const initialQuery = { combinator: 'and', rules: [] };
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function parseExpectedValues(ruleType, value) {
  if (ruleType === 'resource_valid_content_hash') return String(value ?? '').trim();

  if (ruleType === 'allowed_working_hours') {
    return String(value ?? '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((x) => Number(x));
  }

  if (Array.isArray(value)) return value;

  const parts = String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ruleType === 'allowed_locations') {
    return parts.map((p) => {
      const n = Number(p);
      return Number.isFinite(n) ? n : p;
    });
  }

  return parts;
}
const hasValue = (v) => {
  if (typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.length > 0;
  return String(v ?? '').trim().length > 0;
};

function qbNodeToPolicyNode(node) {
  // Group
  if (node && Array.isArray(node.rules)) {
    const children = node.rules
      .map(qbNodeToPolicyNode)
      .filter(Boolean); // remove empty rules/groups

    if (children.length === 0) return null;

    return {
      combinator: node.combinator ?? 'and',
      not: !!node.not,
      rules: children,
    };
  }

  // Leaf rule
  if (!node?.field) return null;
  if (!hasValue(node.value)) return null;

  return {
    rule_type: node.field,
    operator: node.operator ?? 'in',
    expected_values: parseExpectedValues(node.field, node.value),
  };
}

function toPolicyPayload({ policyName, objectId, query }) {
  const expr = qbNodeToPolicyNode(query) ?? { combinator: 'and', not: false, rules: [] };

  const payload = {
    policy_name: policyName?.trim() || 'Untitled Policy',
    expression: expr, // ✅ tree (keeps groups)
  };

  if (isNonEmptyString(objectId)) payload.object_id = objectId.trim();
  return payload;
}



function fromPolicyPayload(policy) {
  const leftRel = policy?.rules?.find((r) => r?.left_relation)?.left_relation;
  const combinator = leftRel === 'or' ? 'or' : 'and';

  return {
    combinator,
    rules: (policy?.rules ?? []).map((r) => ({
      field: r.rule_type,
      operator:
        r.rule_type === 'resource_valid_content_hash' || r.rule_type === 'allowed_working_hours'
          ? '='
          : 'in',
      value: Array.isArray(r.expected_values)
        ? r.expected_values
        : String(r.expected_values ?? ''),
    })),
  };
}

const JsonPopoverButton = ({ label, value }) => {
  const pretty = useMemo(() => {
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  }, [value]);

  return (
    <Popover positioning="below-start">
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="secondary">{label}</Button>
      </PopoverTrigger>

      <PopoverSurface style={{ width: 600, maxWidth: '90vw' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <Text weight="semibold">{label}</Text>

          <Textarea
            readOnly
            value={pretty}
            rows={16}
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          />
        </div>
      </PopoverSurface>
    </Popover>
  );
};



const SetPolicies = ({ initialPolicy }) => {
  const { isDarkMode } = useTheme();

  const [policyName, setPolicyName] = useState(initialPolicy?.policy_name ?? '');
  const [objectId, setObjectId] = useState(initialPolicy?.object_id ?? '');
  const [query, setQuery] = useState(
    initialPolicy ? fromPolicyPayload(initialPolicy) : initialQuery
  );

  const [abacFields, setAbacFields] = useState(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // get a bigger page so object_ids has enough options
        const res = await CATALOG_API.fetchCatalog({ page: 1, perPage: 200 });

        // Map backend files -> QueryBuilder values
        const objectIds = (res?.data ?? []).map((f) => ({
          name: f.id,
          label: `${f.filename} (${f.project_id}) · ${f.file_type} · ${f.id.slice(0, 8)}`,
        }));

        const flds = await getAbacFields({ objectIds });

        if (mounted) setAbacFields(flds);
      } catch (e) {
        console.error('Failed to load catalog/fields:', e);
        if (mounted) setAbacFields([]);
      } finally {
        if (mounted) setFieldsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);


  // ✅ Hooks must run every render, so compute memo BEFORE any conditional return
  const policyPreview = useMemo(() => {
    return toPolicyPayload({ policyName, objectId, query });
  }, [policyName, objectId, query]);

  const handlePostPolicy = async () => {
    try {
      const data = await POLICIES_API.postPolicy(policyPreview);
      console.log('Policy saved:', data?.message ?? data);
    } catch (error) {
      console.error('Error saving policy:', error);
    }
  };

  if (fieldsLoading) {
    return (
      <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
        <div className="set-policies-container">
          <Spinner size="large" />
        </div>
      </FluentProvider>
    );
  }

  if (!abacFields) {
    return (
      <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
        <div className="set-policies-container">
          Failed to load fields.
        </div>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
      <div className={`set-policies-container ${isDarkMode ? 'dark-theme' : ''}`}>
        <h2>Set Policies</h2>

        <div style={{ display: 'grid', gap: 12, maxWidth: 720, marginBottom: 16 }}>
          <Field label="Policy name">
            <Input
              value={policyName}
              onChange={(_, data) => setPolicyName(data.value)}
              placeholder="Sample Access Control Policy"
            />
          </Field>

          <Field
            label="Target object id (optional)"
            hint="If set, this policy applies to a specific resource/object."
          >
            <Input
              value={objectId}
              onChange={(_, data) => setObjectId(data.value)}
              placeholder="e.g. resource-123 / 42 / 0xabc..."
            />
          </Field>
        </div>

        <QueryBuilderDnD dnd={{ ...ReactDnD, ...ReactDndHtml5Backend }}>
          <QueryBuilderFluent>
            <QueryBuilder
              fields={abacFields}
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

        <div className="button-container" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button appearance="primary" onClick={handlePostPolicy}>
            Save Policy
          </Button>

          <JsonPopoverButton
            label="Query JSON"
            value={formatQuery(query, 'json_without_ids')}
          />
          <JsonPopoverButton
            label="Payload JSON"
            value={policyPreview}
          />

        </div>
      </div>
    </FluentProvider>
  );
};

export default SetPolicies;
