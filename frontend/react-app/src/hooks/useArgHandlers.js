export const useArgHandlers = (updateExpectation, setTableExpectations) => {
    const handleArgChange = (column, ruleName, newValue, keyPath = []) => {
      const updatedArgs = {};
      let target = updatedArgs;
      for (let i = 0; i < keyPath.length - 1; i++) {
        const k = keyPath[i];
        if (!target[k]) target[k] = {};
        target = target[k];
      }
      target[keyPath[keyPath.length - 1]] = newValue;
  
      updateExpectation(column, ruleName, true, updatedArgs);
    };
  
    const handleTableArgChange = (rule, newValue, keyPath) => {
      setTableExpectations(prev => {
        const updated = { ...prev };
        let current = updated[rule] || {};
        let target = current;
        for (let i = 0; i < keyPath.length - 1; i++) {
          const k = keyPath[i];
          if (!target[k]) target[k] = {};
          target = target[k];
        }
        target[keyPath[keyPath.length - 1]] = newValue;
        return {
          ...updated,
          [rule]: current
        };
      });
    };
  
    return {
      handleArgChange,
      handleTableArgChange
    };
  };
  