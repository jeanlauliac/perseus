import { MapToRxValue, RxValue, RxZippedValue } from "./values";

export function map<Value, MappedValue>(
  source: RxValue<Value>,
  mapper: (_: Value) => MappedValue
): RxValue<MappedValue> {
  return new RxZippedValue([source], (values) => mapper(values[0]));
}

export function if_<Value, MappedValue>(
  condition: RxValue<Value>,
  truthyValue: MappedValue,
  falsyValue: MappedValue = null
): RxValue<MappedValue> {
  return map(condition, (value) => (value ? truthyValue : falsyValue));
}

export function zip<InputTuple extends ReadonlyArray<unknown>, ZippedValue>(
  values: MapToRxValue<InputTuple>,
  zipper: (_: InputTuple) => ZippedValue
): RxValue<ZippedValue> {
  return new RxZippedValue(values, zipper);
}
