// Pretrained policy (BRD 2.2.4.2): a small Catniff network scoring every boss move.
// In Node "catniff" resolves to the npm package; in the browser the import map points at vendor/catniff.js.
import catniff from "catniff";
import { ACTIONS } from "../combat/index.js";
import { FEATURE_SIZE } from "./features.js";

const { Tensor, nn } = catniff;
export const POLICY_SHAPE = { inputs: FEATURE_SIZE, hidden: [64, 64], outputs: ACTIONS.length };

export class PolicyNet {
    constructor(shape = POLICY_SHAPE) {
        this.l1 = new nn.Linear(shape.inputs, shape.hidden[0]);
        this.l2 = new nn.Linear(shape.hidden[0], shape.hidden[1]);
        this.l3 = new nn.Linear(shape.hidden[1], shape.outputs);
    }

    forward(x) {
        return this.l3.forward(this.l2.forward(this.l1.forward(x).relu()).relu());
    }
}

/** Scores one feature vector without recording gradients. */
export function scoreWith(net, features) {
    const previous = Tensor.noGrad;
    Tensor.noGrad = true;
    try {
        return net.forward(new Tensor(features)).val();
    } finally {
        Tensor.noGrad = previous;
    }
}

/** Builds a policy from a shipped model file. Throws if the file does not match this game build. */
export function loadPolicy(model) {
    const ok = model && model.shape && model.shape.inputs === POLICY_SHAPE.inputs && model.shape.outputs === POLICY_SHAPE.outputs
        && Array.isArray(model.actions) && model.actions.join() === ACTIONS.join() && model.stateDict;
    if (!ok) throw new Error("Boss model does not match this game build");
    const net = new PolicyNet(model.shape);
    nn.state.loadStateDict(net, model.stateDict);
    return { net, scores: (features) => scoreWith(net, features) };
}
