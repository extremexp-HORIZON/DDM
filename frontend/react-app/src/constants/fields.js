// src/fields.js
import { defaultOperators, toFullOption } from 'react-querybuilder';

export const validator = (rule) => {
  if (typeof rule.value === 'boolean') return true;
  if (Array.isArray(rule.value)) return rule.value.length > 0;
  return String(rule.value ?? '').trim().length > 0;
};

const ops = {
  equals: defaultOperators.filter((op) => op.name === '='),
  in: defaultOperators.filter((op) => op.name === 'in'),
  notIn: defaultOperators.filter((op) => op.name === 'notIn'),
};

async function loadRoles() {
  return [
    { name: 'admin', label: 'Admin' },
    { name: 'manager', label: 'Manager' },
    { name: 'user', label: 'User' },
  ];
}

async function loadGroups() {
  return [
    { name: 'admin', label: 'Admin group' },
    { name: 'finance', label: 'Finance' },
    { name: 'engineering', label: 'Engineering' },
  ];
}

async function loadLocations() {
  return [
    { name: 52003254, label: 'Location 52003254' },
    { name: 4376176, label: 'Location 4376176' },
    { name: 51996393, label: 'Location 51996393' },
    { name: 4380279, label: 'Location 4380279' },
  ];
}

async function loadObjectGroups() {
  return [
    { name: 'payments', label: 'Payments resources' },
    { name: 'hr', label: 'HR resources' },
    { name: 'public', label: 'Public resources' },
  ];
}

/**
 * ✅ getAbacFields now accepts injected lists.
 * Pass objectIds from /catalog/list mapping.
 */
export async function getAbacFields({
  objectIds = [],      // <--- inject from /catalog/list
  objectGroups = null, // optional override
  roles = null,
  groups = null,
  locations = null,
} = {}) {
  const [loadedRoles, loadedGroups, loadedLocations, loadedObjectGroups] =
    await Promise.all([loadRoles(), loadGroups(), loadLocations(), loadObjectGroups()]);

  const finalRoles = roles ?? loadedRoles;
  const finalGroups = groups ?? loadedGroups;
  const finalLocations = locations ?? loadedLocations;
  const finalObjectGroups = objectGroups ?? loadedObjectGroups;

  const fields = [
    // SUBJECT
    {
      name: 'allowed_roles',
      label: 'Subject · Role (allowed_roles)',
      placeholder: 'Select one or more roles',
      valueEditorType: 'multiselect',
      values: finalRoles,
      operators: ops.in,
      validator,
    },
    {
      name: 'allowed_groups',
      label: 'Subject · Group membership (allowed_groups)',
      placeholder: 'Select one or more groups',
      valueEditorType: 'multiselect',
      values: finalGroups,
      operators: ops.in,
      validator,
    },

    // OBJECT (✅ now fed by API)
    {
      name: 'object_ids',
      label: 'Object · Resource IDs (object_ids)',
      placeholder: 'Select one or more files',
      valueEditorType: 'multiselect',
      values: objectIds,          // <--- FROM /catalog/list
      operators: ops.in,
      validator,
    },
    {
      name: 'object_groups',
      label: 'Object · Resource groups (object_groups)',
      placeholder: 'Select one or more resource groups',
      valueEditorType: 'multiselect',
      values: finalObjectGroups,
      operators: ops.in,
      validator,
    },
    {
      name: 'resource_valid_content_hash',
      label: 'Object · Content hash (resource_valid_content_hash)',
      placeholder: '0x…',
      valueEditorType: 'text',
      operators: ops.equals,
      validator,
    },

    // ENVIRONMENT
    {
      name: 'allowed_locations',
      label: 'Environment · Location IDs (allowed_locations)',
      placeholder: 'Select one or more locations',
      valueEditorType: 'multiselect',
      values: finalLocations,
      operators: ops.in,
      validator,
    },
    {
      name: 'allowed_ip_whitelist',
      label: 'Environment · IP allowlist (allowed_ip_whitelist)',
      placeholder: 'e.g. 127.0.0.1, 172.21.0.1',
      valueEditorType: 'multiselect',
      values: [
        { name: '127.0.0.1', label: '127.0.0.1' },
        { name: '172.21.0.1', label: '172.21.0.1' },
        { name: '172.21.0.10', label: '172.21.0.10' },
      ],
      operators: ops.in,
      validator,
    },

    // CONTEXT
    {
      name: 'allowed_working_hours',
      label: 'Context · Working hours window (allowed_working_hours)',
      placeholder: 'startDay,startHour,endDay,endHour  (e.g. 1,24,1,7)',
      valueEditorType: 'text',
      operators: ops.equals,
      validator,
    },
  ].map(toFullOption);

  return fields;
}
