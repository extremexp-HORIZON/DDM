export const getExpandAllMap = (datasets) =>
    datasets.reduce((acc, item) => ({ ...acc, [item.id]: true }), {});
  