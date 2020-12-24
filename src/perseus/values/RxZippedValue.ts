import { assert } from "../utils";
import {
  MapToRxValue,
  RxValue,
  RxValueNode,
  RxZippedValueNode,
  RxZippedValueNodeContext,
} from "./types";

// This handles 'zipping' several other `RxValues` together into a single
// output value. Zipping is just the same as a 'map' operation, just
// with several inputs at a time.
export class RxZippedValue<
  InputTuple extends ReadonlyArray<unknown>,
  ZippedValue
> implements RxValue<ZippedValue> {
  type: "rx_value" = "rx_value";

  // The nodes in the update graph that we created
  // to control each input value.
  private _nodes?: RxZippedValueNode[] = undefined;

  // The context is basically a node of the graph
  // that takes all the value nodes as input.
  private _context?: RxZippedValueNodeContext = undefined;

  private _sources: ReadonlyArray<RxValue<unknown>>;
  private _zipper: (_: unknown) => unknown;

  constructor(
    sources: MapToRxValue<InputTuple>,
    zipper: (_: InputTuple) => ZippedValue
  ) {
    this._sources = sources;
    this._zipper = zipper;
  }

  register<Node extends RxValueNode>(initNode: (_: ZippedValue) => Node): Node {
    // If there's a context, we already registered a dependee before, we
    // are already in the update graph and the value is up-to-date.
    // We just append the new dependendee.
    if (this._context != null) {
      const newNode = initNode(this._context.value as ZippedValue);
      this._context.dependees.push(newNode);
      return newNode;
    }

    // Create a skeleton of the context. We need to construct the nodes,
    // but we don't have any values yet.
    let context: RxZippedValueNodeContext;
    this._context = context = {
      sourceValues: [],
      zipper: this._zipper,
      value: undefined,
      dependees: [],
    };

    // Register a node into each source, keeping in track the exact
    // index within the source array. These indices will be matched in the
    // `_nodes` and the `sourceValues` arrays, and they all have the same
    // length.
    this._nodes = this._sources.map((source, index) =>
      source.register((sourceValue) => {
        context.sourceValues.push(sourceValue);
        return { type: "zipped_value", index, context } as RxZippedValueNode;
      })
    );

    // Now that we registered all inputs, we have our array of source values.
    // We can call the user-defined zipper callback to compute the initial
    // 'zipped' value, which in turns allows us to initialize the dependee.
    context.value = this._zipper(context.sourceValues);
    const newNode = initNode(context.value as ZippedValue);
    context.dependees.push(newNode);

    return newNode;
  }

  unregister(node: RxValueNode): void {
    // That node has to be in our dependees.
    const index = this._context.dependees.indexOf(node);
    assert(index >= 0);

    // Get rid of it, if there are other dependees, then
    // nothing else happen, we need to keep updating the values.
    this._context.dependees.splice(index, 1);
    if (this._context.dependees.length > 0) return;

    // If we don't need the nodes anymore, we'll unregister
    // everything (might allow for our sources to unregister their
    // own sources, in turn). We make sure to empty the state so
    // that this value can become live again if `register` is called.
    this._sources.forEach((source, index) => {
      source.unregister(this._nodes[index]);
    });
    this._nodes = undefined;
    this._context = undefined;
  }
}
