import { RxMappedValue, RxValue, RxValueNode } from "./values";

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

type MapToRxValue<T> = { [K in keyof T]: MapToRxValue<T[K]> };

export function zip<InputTuple, ZippedValue>(
  values: MapToRxValue<InputTuple>,
  zipper: (_: InputTuple) => ZippedValue
): RxValue<ZippedValue> {
  // return new RxMappedValue();
  throw new Error("non impl");
}
