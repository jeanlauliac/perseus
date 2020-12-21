import { RxMappedValue, RxValue } from "./values";

export function map<Value, MappedValue>(
  source: RxValue<Value>,
  mapper: (_: Value) => MappedValue
): RxValue<MappedValue> {
  return new RxMappedValue(source, mapper);
}

export function if_<Value, MappedValue>(
  condition: RxValue<Value>,
  truthyValue: MappedValue,
  falsyValue: MappedValue = null
): RxValue<MappedValue> {
  return map(condition, (value) => (value ? truthyValue : falsyValue));
}
