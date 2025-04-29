// 🎯 Category Options (keep JSX icons)
export const tableCategoryOptions = [
    { label: "Volume", value: "volume", icon: "pi pi-database" },
    { label: "Schema", value: "schema", icon: "pi pi-sitemap" },
];

export const columnCategoryOptions = [
    { label: "Schema", value: "schema", icon: "pi pi-sitemap" },
    { label: "Completeness", value: "completeness", icon: "pi pi-sliders-h" },
    { label: "Uniqueness", value: "uniqueness", icon: "pi pi-star" },
    { label: "Validity", value: "validity", icon: "pi pi-check-circle" },
    { label: "Numeric", value: "numeric", icon: "pi pi-percentage" },
];

export const categoryOptionTemplate = (option) => (
    <div className="flex align-items-center">
        <i className={`${option.icon} mr-2`} />
        {option.label}
    </div>
);

export const selectedCategoryTemplate = (option, props) => {
    if (option) {
        return (
            <div className="flex align-items-center">
                <i className={`${option.icon} mr-2`} />
                {option.label}
            </div>
        );
    }
    return <span>{props.placeholder}</span>;
};




export const renderExpectationType = (rowData, expectationDescriptions = {}) => {
    const expectationType = rowData.expectation_type || rowData.type;
    const description = expectationDescriptions[expectationType]?.description || "";

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {expectationType}

            <a
                href={`https://greatexpectations.io/expectations/${expectationType}`}
                target="_blank"
                rel="noopener noreferrer"
                className="expectation-doc-link"
                data-pr-tooltip="Open Docs"
                style={{ color: "inherit" }}
            >
                <i className="pi pi-external-link" />
            </a>

            {description && (
                <i
                    className="pi pi-info-circle expectation-tooltip"
                    data-pr-tooltip={description}
                    style={{ fontSize: "1rem", color: "#6b7280", cursor: "pointer" }}
                />
            )}
        </div>
    );
};


// 📚 Arguments Renderer
export const renderArguments = (rowData) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {Object.entries(rowData.kwargs || {})
            .filter(([k]) => k !== "batch_id" && k !== "column")
            .map(([k, v], idx) => {
                const valueStr = String(v);
                const valueParts = valueStr.includes(",") ? valueStr.split(",") : [valueStr];
                return (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <div>{k}:</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {valueParts.map((part, i) => (
                                <div key={i}>{part.trim()}</div>
                            ))}
                        </div>
                    </div>
                );
            })}
    </div>
);



export const statusOptions = [
    { label: "Passed", value: true, icon: "pi pi-check-circle" },
    { label: "Failed", value: false, icon: "pi pi-times-circle" },
  ];
  
  export const statusOptionTemplate = (option) => {
    return (
      <div className="flex align-items-center">
        <i className={`${option.icon} mr-2`} />
        {option.label}
      </div>
    );
  };
  
  export const selectedStatusTemplate = (option, props) => {
    if (option) {
      return (
        <div className="flex align-items-center">
          <i className={`${option.icon} mr-2`} />
          {option.label}
        </div>
      );
    }
    return <span>{props.placeholder}</span>;
  };
   
