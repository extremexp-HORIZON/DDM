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
    const result = await pollTaskResult(taskId, 1000, 120000); // ✅ No destructuring
    console.log("📦 Raw result from pollTaskResult:", result);
  
    const columnExpectations = result.expectations || {};
    const tableExpectationsRaw = result.table_expectations || {};
  
    const columnRules = {};
    const initialExpectations = {};
  
    // Loop through each column and categorize its expectations
    Object.entries(columnExpectations).forEach(([column, categories]) => {
      initialExpectations[column] = initialExpectations[column] || {};
  
      Object.entries(categories).forEach(([category, rules]) => {
        columnRules[category] = columnRules[category] || [];
  
        rules.forEach(rule => {
          const type = rule.expectation_type;
          initialExpectations[column][type] = {
            ...(rule.kwargs || {}),
            _enabled: false,
          };
  
          if (!columnRules[category].some(r => r.name === type)) {
            columnRules[category].push({
              name: type,
              description: rule.description || "",
              arguments: Object.entries(rule.kwargs || {}).map(([name, value]) => ({
                name,
                expected_value: value
              })),
            });
          }
        });
      });
    });
  
    const initialTableExpectations = {};
    const tableRules = {};
  
    Object.entries(tableExpectationsRaw).forEach(([category, rules]) => {
      tableRules[category] = [];
  
      rules.forEach(rule => {
        const args = rule.kwargs || {};
        const hasValues = Object.values(args).some(v => v !== null && v !== "");
  
        initialTableExpectations[rule.expectation_type] = {
          ...args,
          _enabled: hasValues
        };
  
        tableRules[category].push({
          name: rule.expectation_type,
          description: rule.description || "",
          arguments: Object.entries(args).map(([name, value]) => ({
            name,
            expected_value: value
          })),
        });
      });
    });
  
    setExpectations(initialExpectations);
    setTableExpectations(initialTableExpectations);
    setExpectationRules({
      ...columnRules,
      table: tableRules
    });
    setSuiteName(result.suite_name || "default_suite");
  
    return result; // ✅ Also update return value
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
