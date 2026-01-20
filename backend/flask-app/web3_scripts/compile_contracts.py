from solcx import compile_files, install_solc, set_solc_version
import json, os

# Set Solidity version
SOLC_VERSION = "0.8.20"
install_solc(SOLC_VERSION)
set_solc_version(SOLC_VERSION)

output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "compiled_contracts"))
os.makedirs(output_dir, exist_ok=True)

def compile_contracts(contract_paths, output_dir):
    """
    Compiles Solidity contracts and saves their ABI + bytecode JSON files.
    Supports imports between files.
    """
    compiled = compile_files(
        contract_paths,
        output_values=["abi", "bin"],
        base_path="..",  # tell solcx the base path (the directory above web3_scripts)
        import_remappings=[
            "@openzeppelin=node_modules/@openzeppelin"  # map OpenZeppelin imports
        ]
    )
    

    os.makedirs(output_dir, exist_ok=True)

    for full_name, contract_data in compiled.items():
        # Example: '../smart_contracts/RewardToken.sol:RewardToken'
        file_name, contract_name = full_name.split(":")
        file_base = os.path.splitext(os.path.basename(file_name))[0]
        output_filename = f"{file_base}_{contract_name}.json"
        output_path = os.path.join(output_dir, output_filename)

        with open(output_path, "w") as outfile:
            json.dump(contract_data, outfile, indent=4)

        print(f"✅ Compiled: {full_name} → {output_path}")

if __name__ == "__main__":
    contracts_to_compile = [
        "../smart_contracts/RewardToken.sol",
        "../smart_contracts/DatasetRegistry.sol",
        "../smart_contracts/IValidatorsRegistry.sol",
        "../smart_contracts/ValidatorsRegistry.sol",
        "../smart_contracts/ValidationRegistry.sol",
        "../smart_contracts/CategoryRegistry.sol",
        "../smart_contracts/FileFormatRegistry.sol",
        "../smart_contracts/SuiteRequestRegistry.sol",
        "../smart_contracts/RewardClaimer.sol"
    ]

    output_dir = "compiled_contracts"
    compile_contracts(contracts_to_compile, output_dir)
