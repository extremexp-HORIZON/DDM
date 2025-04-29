import json
import inspect
from great_expectations.expectations.registry import list_registered_expectation_implementations, get_expectation_impl

def dump_class_info(name):
    try:
        cls = get_expectation_impl(name)
        return {
            "name": name,
            "doc": (cls.__doc__ or "").strip().split("\n")[0],
            "has_default_kwarg_values": hasattr(cls, "default_kwarg_values"),
            "default_kwarg_values": getattr(cls, "default_kwarg_values", None),
            "expectation_type": getattr(cls, "expectation_type", None),
            "init_signature": str(inspect.signature(cls.__init__)),
            "class_vars": [k for k in dir(cls) if not k.startswith("__")],
            "methods": [k for k, v in inspect.getmembers(cls, predicate=inspect.isfunction)],
        }
    except Exception as e:
        return {"name": name, "error": str(e)}

if __name__ == "__main__":
    all_names = list_registered_expectation_implementations()
    data = [dump_class_info(name) for name in all_names]

    with open("expectation_class_dump.json", "w") as f:
        json.dump(data, f, indent=2)

    print("✅ Class dump saved to expectation_class_dump.json")
