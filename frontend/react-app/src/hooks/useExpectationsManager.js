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
    console.log("📦 Raw result from pollTaskResult:", result);

    const tableRules = result.categorized?.table || {};
    const tableValues = result.table_expectations || {};

    console.log("🧱 Original tableRules:", tableRules);
    console.log("🗂 table_expectations (raw):", tableValues);

    // Merge arguments into categorized.table from table_expectations
    for (const [category, rules] of Object.entries(tableRules)) {
      const enrichedRules = rules.map(rule => {
        const matching = (tableValues?.[category] || []).find(r => r.name === rule.name);
        return {
          ...rule,
          arguments: matching?.arguments?.length ? matching.arguments : rule.arguments || []
        };
      });
      tableRules[category] = enrichedRules;
    }

    console.log("✅ Merged tableRules with arguments:", tableRules);

    // Build initial column-level expectations
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

    console.log("📌 Parsed initial column-level expectations:", initialExpectations);

    // Build initial table-level expectations
    const initialTableExpectations = {};
    for (const [category, rules] of Object.entries(tableRules)) {
      for (const rule of rules) {
        const matchedRule = (tableValues[category] || []).find(tv => tv.name === rule.name);
        const matchedArgs = matchedRule?.args || {};
        const hasValues = Object.values(matchedArgs).some(v => v !== null && v !== "");

        const defaults = (rule.arguments || []).reduce((acc, arg) => {
          acc[arg.name] = matchedArgs[arg.name] ?? arg.expected_value ?? "";
          return acc;
        }, {});

        initialTableExpectations[rule.name] = {
          ...defaults,
          _enabled: hasValues,
        };
      }
    }

    console.log("✅ Final initialTableExpectations:", initialTableExpectations);

    // Update state
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
