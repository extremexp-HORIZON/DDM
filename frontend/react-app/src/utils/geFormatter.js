export const toGEFormat = (suiteName, selectedExpectations, tableExpectations, columnDescriptions, tableExpectationDescriptions) => {
  const expectations = [];
  const columnNames = [];

  // Column-level expectations
  for (const [column, checks] of Object.entries(selectedExpectations)) {
    const enabledChecks = Object.entries(checks).filter(([_, config]) => config._enabled);
    if (enabledChecks.length > 0) {
      columnNames.push(column);
    }
    for (const [expectationType, config] of enabledChecks) {
      const { _enabled, description, ...args } = config;
      expectations.push({
        expectation_type: expectationType,
        kwargs: { column, ...args },
      });
    }
  }

  // Table-level expectations
  for (const [expectationType, config] of Object.entries(tableExpectations)) {
    if (config._enabled) {
      const { _enabled, ...args } = config;
      expectations.push({
        expectation_type: expectationType,
        kwargs: args,
      });
    }
  }

  return {
    expectation_suite_name: suiteName,
    expectations,
    meta: {
      column_descriptions: columnDescriptions,
      column_names: columnNames,
      table_expectation_descriptions: tableExpectationDescriptions,
    },
  };
};
