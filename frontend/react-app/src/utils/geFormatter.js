export const toGEFormat = (suiteName, columnExpectations, tableExpectations, descriptions = {}) => {
    const expectations = [];
  
    // Column-level expectations
    for (const [column, checks] of Object.entries(columnExpectations)) {
      for (const [expectationType, config] of Object.entries(checks)) {
        if (config._enabled) {
          const { _enabled, ...args } = config;
          expectations.push({
            expectation_type: expectationType,
            kwargs: { column, ...args },
          });
        }
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
        column_descriptions: descriptions,
      },
    };
  };
  