// Patch qq-official-bot's Ed25519 implementation to match QQ official webhook signature spec.
// This script overwrites node_modules/qq-official-bot/lib/ed25519.js inside the Docker image.

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'node_modules', 'qq-official-bot', 'lib', 'ed25519.js');

const content = `"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _Ed25519_instances, _Ed25519_privateKey, _Ed25519_publicKey_get;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ed25519 = void 0;
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const ed25519_1 = require("@noble/curves/ed25519");
class Ed25519 {
    constructor(secret) {
        _Ed25519_instances.add(this);
        _Ed25519_privateKey.set(this, void 0);
        while (secret.length < 32)
            secret = secret.repeat(2);
        secret = secret.slice(0, 32);
        __classPrivateFieldSet(this, _Ed25519_privateKey, Buffer.from(secret), "f");
    }
    sign(message) {
        // Sign UTF-8 bytes of (event_ts + plain_token) and return hex string.
        const content = Buffer.from(message, 'utf8');
        const signResult = ed25519_1.ed25519.sign(content, __classPrivateFieldGet(this, _Ed25519_privateKey, "f"));
        return Buffer.from(signResult).toString('hex');
    }
    verify(signature, message) {
        // QQ sends hex signature; convert to bytes before verifying.
        const sigBytes = Buffer.from(signature, 'hex');
        const msgBytes = Buffer.from(message, 'utf8');
        return ed25519_1.ed25519.verify(sigBytes, msgBytes, __classPrivateFieldGet(this, _Ed25519_instances, "a", _Ed25519_publicKey_get));
    }
}
exports.Ed25519 = Ed25519;
_Ed25519_privateKey = new WeakMap(), _Ed25519_instances = new WeakSet(), _Ed25519_publicKey_get = function _Ed25519_publicKey_get() {
    return ed25519_1.ed25519.getPublicKey(__classPrivateFieldGet(this, _Ed25519_privateKey, "f"));
};
/**
 * ed25519 curve with EdDSA signatures.
 */
exports.default = ed25519_1.ed25519;
`;

if (!fs.existsSync(target)) {
  console.error('Target ed25519.js not found at', target);
  process.exit(1);
}

fs.writeFileSync(target, content, 'utf8');
console.log('Patched', target);

