// hooks/useExpectationsManager.js
import { useState } from 'react';
import { pollTaskResult } from '../api/tasks';

export const useExpectationsManager = ({ toast, showMessage }) => {
  const [expectations, setExpectations] = useState([]);
  const [expectationRules, setExpectationRules] = useState({});
  const [selectedExpectations, setSelectedExpectations] = useState({});
  const [tableExpectations, setTableExpectations] = useState({});
  const [suiteName, setSuiteName] = useState("");

  const handleExpectations = async (taskId) => {
    const result = await pollTaskResult(taskId, 1000, 120000);
    const tableRules = result.categorized?.table || {};
    const tableValues = Object.values(result.table_expectations || {}).flat();

    const initialExpectations = {};
    result.expectations?.forEach(exp => {
      const col = exp.column;
      initialExpectations[col] = {};
      Object.entries(exp.checks || {}).forEach(([rule, details]) => {
        initialExpectations[col][rule] = {
          ...(details.args || {}),
          _enabled: false,
        };
      });
    });

    const initialTableExpectations = {};
    for (const [, rules] of Object.entries(tableRules)) {
      for (const rule of rules) {
        const defaults = (rule.arguments || []).reduce((acc, a) => {
          acc[a.name] = a.expected_value ?? "";
          return acc;
        }, {});
        const matched = tableValues.find(tv => tv.name === rule.name)?.args || {};
        const hasValues = Object.values(matched).some(v => v !== null && v !== "");
        initialTableExpectations[rule.name] = {
          ...defaults,
          ...matched,
          _enabled: hasValues,
        };
      }
    }

    setExpectationRules({ ...result.categorized, table: tableRules });
    setExpectations(result.expectations || []);
    setSelectedExpectations(initialExpectations);
    setTableExpectations(initialTableExpectations);
    setSuiteName(result.suite_name || "default_suite");

    return result;
  };

  const updateExpectation = (column, rule, enabled, args = {}) => {
    setSelectedExpectations(prev => ({
      ...prev,
      [column]: {
        ...prev[column],
        [rule]: { ...(prev[column]?.[rule] || {}), ...args, _enabled: enabled },
      },
    }));
  };

  const updateTableExpectation = (rule, enabled, args = {}) => {
    setTableExpectations(prev => ({
      ...prev,
      [rule]: {
        ...(prev[rule] || {}),
        ...args,
        _enabled: enabled,
      },
    }));
  };

  return {
    expectations,
    expectationRules,
    selectedExpectations,
    tableExpectations,
    suiteName,
    setSelectedExpectations,
    setTableExpectations,
    setSuiteName,
    handleExpectations,
    updateExpectation,
    updateTableExpectation,
  };
};
