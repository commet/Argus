var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/sync-health.ts
function reportSyncFailure(context, opts = {}) {
  sessionSyncFailures++;
  const surface = opts.surface ?? true;
  if (surface && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("argus:sync", {
        detail: { status: "error", context, message: opts.message }
      })
    );
  }
  if (typeof window !== "undefined" && context !== "analytics" && !reportingTelemetryFailure) {
    reportingTelemetryFailure = true;
    void Promise.resolve().then(() => (init_analytics(), analytics_exports)).then(({ track: track2 }) => {
      track2("sync_write_failure", {
        context,
        message: opts.message?.slice(0, 240) || null,
        surfaced: surface
      });
    }).finally(() => {
      reportingTelemetryFailure = false;
    });
  }
}
var sessionSyncFailures, reportingTelemetryFailure;
var init_sync_health = __esm({
  "src/lib/sync-health.ts"() {
    "use strict";
    sessionSyncFailures = 0;
    reportingTelemetryFailure = false;
  }
});

// node_modules/tslib/tslib.es6.mjs
var tslib_es6_exports = {};
__export(tslib_es6_exports, {
  __addDisposableResource: () => __addDisposableResource,
  __assign: () => __assign,
  __asyncDelegator: () => __asyncDelegator,
  __asyncGenerator: () => __asyncGenerator,
  __asyncValues: () => __asyncValues,
  __await: () => __await,
  __awaiter: () => __awaiter,
  __classPrivateFieldGet: () => __classPrivateFieldGet,
  __classPrivateFieldIn: () => __classPrivateFieldIn,
  __classPrivateFieldSet: () => __classPrivateFieldSet,
  __createBinding: () => __createBinding,
  __decorate: () => __decorate,
  __disposeResources: () => __disposeResources,
  __esDecorate: () => __esDecorate,
  __exportStar: () => __exportStar,
  __extends: () => __extends,
  __generator: () => __generator,
  __importDefault: () => __importDefault,
  __importStar: () => __importStar,
  __makeTemplateObject: () => __makeTemplateObject,
  __metadata: () => __metadata,
  __param: () => __param,
  __propKey: () => __propKey,
  __read: () => __read,
  __rest: () => __rest,
  __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
  __runInitializers: () => __runInitializers,
  __setFunctionName: () => __setFunctionName,
  __spread: () => __spread,
  __spreadArray: () => __spreadArray,
  __spreadArrays: () => __spreadArrays,
  __values: () => __values,
  default: () => tslib_es6_default
});
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __rest(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
}
function __decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) {
    if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
    return f;
  }
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1; i >= 0; i--) {
    var context = {};
    for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
    for (var p in contextIn.access) context.access[p] = contextIn.access[p];
    context.addInitializer = function(f) {
      if (done) throw new TypeError("Cannot add initializers after decoration has completed");
      extraInitializers.push(accept(f || null));
    };
    var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
    if (kind === "accessor") {
      if (result === void 0) continue;
      if (result === null || typeof result !== "object") throw new TypeError("Object expected");
      if (_ = accept(result.get)) descriptor.get = _;
      if (_ = accept(result.set)) descriptor.set = _;
      if (_ = accept(result.init)) initializers.unshift(_);
    } else if (_ = accept(result)) {
      if (kind === "field") initializers.unshift(_);
      else descriptor[key] = _;
    }
  }
  if (target) Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
}
function __runInitializers(thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0; i < initializers.length; i++) {
    value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  }
  return useValue ? value : void 0;
}
function __propKey(x) {
  return typeof x === "symbol" ? x : "".concat(x);
}
function __setFunctionName(f, name, prefix) {
  if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
  return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
}
function __metadata(metadataKey, metadataValue) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __exportStar(m, o) {
  for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
    next: function() {
      if (o && i >= o.length) o = void 0;
      return { value: o && o[i++], done: !o };
    }
  };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
}
function __spread() {
  for (var ar = [], i = 0; i < arguments.length; i++)
    ar = ar.concat(__read(arguments[i]));
  return ar;
}
function __spreadArrays() {
  for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
  for (var r = Array(s), k = 0, i = 0; i < il; i++)
    for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
      r[k] = a[j];
  return r;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
}
function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
}
function __makeTemplateObject(cooked, raw) {
  if (Object.defineProperty) {
    Object.defineProperty(cooked, "raw", { value: raw });
  } else {
    cooked.raw = raw;
  }
  return cooked;
}
function __importStar(mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) {
    for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
  }
  __setModuleDefault(result, mod);
  return result;
}
function __importDefault(mod) {
  return mod && mod.__esModule ? mod : { default: mod };
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldIn(state, receiver) {
  if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
  return typeof state === "function" ? receiver === state : state.has(receiver);
}
function __addDisposableResource(env, value, async) {
  if (value !== null && value !== void 0) {
    if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
    var dispose, inner;
    if (async) {
      if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
      dispose = value[Symbol.asyncDispose];
    }
    if (dispose === void 0) {
      if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
      dispose = value[Symbol.dispose];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
    if (inner) dispose = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    env.stack.push({ value, dispose, async });
  } else if (async) {
    env.stack.push({ async: true });
  }
  return value;
}
function __disposeResources(env) {
  function fail(e) {
    env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
    env.hasError = true;
  }
  var r, s = 0;
  function next() {
    while (r = env.stack.pop()) {
      try {
        if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
        if (r.dispose) {
          var result = r.dispose.call(r.value);
          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
            fail(e);
            return next();
          });
        } else s |= 1;
      } catch (e) {
        fail(e);
      }
    }
    if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
    if (env.hasError) throw env.error;
  }
  return next();
}
function __rewriteRelativeImportExtension(path, preserveJsx) {
  if (typeof path === "string" && /^\.\.?\//.test(path)) {
    return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
      return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
    });
  }
  return path;
}
var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
var init_tslib_es6 = __esm({
  "node_modules/tslib/tslib.es6.mjs"() {
    extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    __assign = function() {
      __assign = Object.assign || function __assign2(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    __createBinding = Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    __setModuleDefault = Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    };
    ownKeys = function(o) {
      ownKeys = Object.getOwnPropertyNames || function(o2) {
        var ar = [];
        for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
        return ar;
      };
      return ownKeys(o);
    };
    _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };
    tslib_es6_default = {
      __extends,
      __assign,
      __rest,
      __decorate,
      __param,
      __esDecorate,
      __runInitializers,
      __propKey,
      __setFunctionName,
      __metadata,
      __awaiter,
      __generator,
      __createBinding,
      __exportStar,
      __values,
      __read,
      __spread,
      __spreadArrays,
      __spreadArray,
      __await,
      __asyncGenerator,
      __asyncDelegator,
      __asyncValues,
      __makeTemplateObject,
      __importStar,
      __importDefault,
      __classPrivateFieldGet,
      __classPrivateFieldSet,
      __classPrivateFieldIn,
      __addDisposableResource,
      __disposeResources,
      __rewriteRelativeImportExtension
    };
  }
});

// node_modules/@supabase/functions-js/dist/main/helper.js
var require_helper = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/helper.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveFetch = void 0;
    var resolveFetch3 = (customFetch) => {
      if (customFetch) {
        return (...args) => customFetch(...args);
      }
      return (...args) => fetch(...args);
    };
    exports.resolveFetch = resolveFetch3;
  }
});

// node_modules/@supabase/functions-js/dist/main/types.js
var require_types = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FunctionRegion = exports.FunctionsHttpError = exports.FunctionsRelayError = exports.FunctionsFetchError = exports.FunctionsError = void 0;
    var FunctionsError2 = class extends Error {
      constructor(message, name = "FunctionsError", context) {
        super(message);
        this.name = name;
        this.context = context;
      }
    };
    exports.FunctionsError = FunctionsError2;
    var FunctionsFetchError2 = class extends FunctionsError2 {
      constructor(context) {
        super("Failed to send a request to the Edge Function", "FunctionsFetchError", context);
      }
    };
    exports.FunctionsFetchError = FunctionsFetchError2;
    var FunctionsRelayError2 = class extends FunctionsError2 {
      constructor(context) {
        super("Relay Error invoking the Edge Function", "FunctionsRelayError", context);
      }
    };
    exports.FunctionsRelayError = FunctionsRelayError2;
    var FunctionsHttpError2 = class extends FunctionsError2 {
      constructor(context) {
        super("Edge Function returned a non-2xx status code", "FunctionsHttpError", context);
      }
    };
    exports.FunctionsHttpError = FunctionsHttpError2;
    var FunctionRegion2;
    (function(FunctionRegion3) {
      FunctionRegion3["Any"] = "any";
      FunctionRegion3["ApNortheast1"] = "ap-northeast-1";
      FunctionRegion3["ApNortheast2"] = "ap-northeast-2";
      FunctionRegion3["ApSouth1"] = "ap-south-1";
      FunctionRegion3["ApSoutheast1"] = "ap-southeast-1";
      FunctionRegion3["ApSoutheast2"] = "ap-southeast-2";
      FunctionRegion3["CaCentral1"] = "ca-central-1";
      FunctionRegion3["EuCentral1"] = "eu-central-1";
      FunctionRegion3["EuWest1"] = "eu-west-1";
      FunctionRegion3["EuWest2"] = "eu-west-2";
      FunctionRegion3["EuWest3"] = "eu-west-3";
      FunctionRegion3["SaEast1"] = "sa-east-1";
      FunctionRegion3["UsEast1"] = "us-east-1";
      FunctionRegion3["UsWest1"] = "us-west-1";
      FunctionRegion3["UsWest2"] = "us-west-2";
    })(FunctionRegion2 || (exports.FunctionRegion = FunctionRegion2 = {}));
  }
});

// node_modules/@supabase/functions-js/dist/main/FunctionsClient.js
var require_FunctionsClient = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/FunctionsClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FunctionsClient = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var helper_1 = require_helper();
    var types_1 = require_types();
    var FunctionsClient2 = class {
      /**
       * Creates a new Functions client bound to an Edge Functions URL.
       *
       * @example
       * ```ts
       * import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
       *
       * const functions = new FunctionsClient('https://xyzcompany.supabase.co/functions/v1', {
       *   headers: { apikey: 'public-anon-key' },
       *   region: FunctionRegion.UsEast1,
       * })
       * ```
       */
      constructor(url, { headers = {}, customFetch, region = types_1.FunctionRegion.Any } = {}) {
        this.url = url;
        this.headers = headers;
        this.region = region;
        this.fetch = (0, helper_1.resolveFetch)(customFetch);
      }
      /**
       * Updates the authorization header
       * @param token - the new jwt token sent in the authorisation header
       * @example
       * ```ts
       * functions.setAuth(session.access_token)
       * ```
       */
      setAuth(token) {
        this.headers.Authorization = `Bearer ${token}`;
      }
      /**
       * Invokes a function
       * @param functionName - The name of the Function to invoke.
       * @param options - Options for invoking the Function.
       * @example
       * ```ts
       * const { data, error } = await functions.invoke('hello-world', {
       *   body: { name: 'Ada' },
       * })
       * ```
       */
      invoke(functionName_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function* (functionName, options = {}) {
          var _a;
          let timeoutId;
          let timeoutController;
          try {
            const { headers, method, body: functionArgs, signal, timeout } = options;
            let _headers = {};
            let { region } = options;
            if (!region) {
              region = this.region;
            }
            const url = new URL(`${this.url}/${functionName}`);
            if (region && region !== "any") {
              _headers["x-region"] = region;
              url.searchParams.set("forceFunctionRegion", region);
            }
            let body;
            if (functionArgs && (headers && !Object.prototype.hasOwnProperty.call(headers, "Content-Type") || !headers)) {
              if (typeof Blob !== "undefined" && functionArgs instanceof Blob || functionArgs instanceof ArrayBuffer) {
                _headers["Content-Type"] = "application/octet-stream";
                body = functionArgs;
              } else if (typeof functionArgs === "string") {
                _headers["Content-Type"] = "text/plain";
                body = functionArgs;
              } else if (typeof FormData !== "undefined" && functionArgs instanceof FormData) {
                body = functionArgs;
              } else {
                _headers["Content-Type"] = "application/json";
                body = JSON.stringify(functionArgs);
              }
            } else {
              if (functionArgs && typeof functionArgs !== "string" && !(typeof Blob !== "undefined" && functionArgs instanceof Blob) && !(functionArgs instanceof ArrayBuffer) && !(typeof FormData !== "undefined" && functionArgs instanceof FormData)) {
                body = JSON.stringify(functionArgs);
              } else {
                body = functionArgs;
              }
            }
            let effectiveSignal = signal;
            if (timeout) {
              timeoutController = new AbortController();
              timeoutId = setTimeout(() => timeoutController.abort(), timeout);
              if (signal) {
                effectiveSignal = timeoutController.signal;
                signal.addEventListener("abort", () => timeoutController.abort());
              } else {
                effectiveSignal = timeoutController.signal;
              }
            }
            const response = yield this.fetch(url.toString(), {
              method: method || "POST",
              // headers priority is (high to low):
              // 1. invoke-level headers
              // 2. client-level headers
              // 3. default Content-Type header
              headers: Object.assign(Object.assign(Object.assign({}, _headers), this.headers), headers),
              body,
              signal: effectiveSignal
            }).catch((fetchError) => {
              throw new types_1.FunctionsFetchError(fetchError);
            });
            const isRelayError = response.headers.get("x-relay-error");
            if (isRelayError && isRelayError === "true") {
              throw new types_1.FunctionsRelayError(response);
            }
            if (!response.ok) {
              throw new types_1.FunctionsHttpError(response);
            }
            let responseType = ((_a = response.headers.get("Content-Type")) !== null && _a !== void 0 ? _a : "text/plain").split(";")[0].trim();
            let data;
            if (responseType === "application/json") {
              data = yield response.json();
            } else if (responseType === "application/octet-stream" || responseType === "application/pdf") {
              data = yield response.blob();
            } else if (responseType === "text/event-stream") {
              data = response;
            } else if (responseType === "multipart/form-data") {
              data = yield response.formData();
            } else {
              data = yield response.text();
            }
            return { data, error: null, response };
          } catch (error) {
            return {
              data: null,
              error,
              response: error instanceof types_1.FunctionsHttpError || error instanceof types_1.FunctionsRelayError ? error.context : void 0
            };
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        });
      }
    };
    exports.FunctionsClient = FunctionsClient2;
  }
});

// node_modules/@supabase/functions-js/dist/main/index.js
var require_main = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FunctionRegion = exports.FunctionsRelayError = exports.FunctionsHttpError = exports.FunctionsFetchError = exports.FunctionsError = exports.FunctionsClient = void 0;
    var FunctionsClient_1 = require_FunctionsClient();
    Object.defineProperty(exports, "FunctionsClient", { enumerable: true, get: function() {
      return FunctionsClient_1.FunctionsClient;
    } });
    var types_1 = require_types();
    Object.defineProperty(exports, "FunctionsError", { enumerable: true, get: function() {
      return types_1.FunctionsError;
    } });
    Object.defineProperty(exports, "FunctionsFetchError", { enumerable: true, get: function() {
      return types_1.FunctionsFetchError;
    } });
    Object.defineProperty(exports, "FunctionsHttpError", { enumerable: true, get: function() {
      return types_1.FunctionsHttpError;
    } });
    Object.defineProperty(exports, "FunctionsRelayError", { enumerable: true, get: function() {
      return types_1.FunctionsRelayError;
    } });
    Object.defineProperty(exports, "FunctionRegion", { enumerable: true, get: function() {
      return types_1.FunctionRegion;
    } });
  }
});

// node_modules/@supabase/postgrest-js/dist/index.mjs
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof(o);
}
function toPrimitive(t, r) {
  if ("object" != _typeof(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}
function _defineProperty(e, r, t) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function ownKeys2(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys2(Object(t), true).forEach(function(r$1) {
      _defineProperty(e, r$1, t[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys2(Object(t)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
    });
  }
  return e;
}
var PostgrestError, PostgrestBuilder, PostgrestTransformBuilder, PostgrestReservedCharsRegexp, PostgrestFilterBuilder, PostgrestQueryBuilder, PostgrestClient;
var init_dist = __esm({
  "node_modules/@supabase/postgrest-js/dist/index.mjs"() {
    PostgrestError = class extends Error {
      /**
      * @example
      * ```ts
      * import PostgrestError from '@supabase/postgrest-js'
      *
      * throw new PostgrestError({
      *   message: 'Row level security prevented the request',
      *   details: 'RLS denied the insert',
      *   hint: 'Check your policies',
      *   code: 'PGRST301',
      * })
      * ```
      */
      constructor(context) {
        super(context.message);
        this.name = "PostgrestError";
        this.details = context.details;
        this.hint = context.hint;
        this.code = context.code;
      }
    };
    PostgrestBuilder = class {
      /**
      * Creates a builder configured for a specific PostgREST request.
      *
      * @example
      * ```ts
      * import PostgrestQueryBuilder from '@supabase/postgrest-js'
      *
      * const builder = new PostgrestQueryBuilder(
      *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
      *   { headers: new Headers({ apikey: 'public-anon-key' }) }
      * )
      * ```
      */
      constructor(builder) {
        var _builder$shouldThrowO, _builder$isMaybeSingl, _builder$urlLengthLim;
        this.shouldThrowOnError = false;
        this.method = builder.method;
        this.url = builder.url;
        this.headers = new Headers(builder.headers);
        this.schema = builder.schema;
        this.body = builder.body;
        this.shouldThrowOnError = (_builder$shouldThrowO = builder.shouldThrowOnError) !== null && _builder$shouldThrowO !== void 0 ? _builder$shouldThrowO : false;
        this.signal = builder.signal;
        this.isMaybeSingle = (_builder$isMaybeSingl = builder.isMaybeSingle) !== null && _builder$isMaybeSingl !== void 0 ? _builder$isMaybeSingl : false;
        this.urlLengthLimit = (_builder$urlLengthLim = builder.urlLengthLimit) !== null && _builder$urlLengthLim !== void 0 ? _builder$urlLengthLim : 8e3;
        if (builder.fetch) this.fetch = builder.fetch;
        else this.fetch = fetch;
      }
      /**
      * If there's an error with the query, throwOnError will reject the promise by
      * throwing the error instead of returning it as part of a successful response.
      *
      * {@link https://github.com/supabase/supabase-js/issues/92}
      */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /**
      * Set an HTTP header for the request.
      */
      setHeader(name, value) {
        this.headers = new Headers(this.headers);
        this.headers.set(name, value);
        return this;
      }
      then(onfulfilled, onrejected) {
        var _this = this;
        if (this.schema === void 0) {
        } else if (["GET", "HEAD"].includes(this.method)) this.headers.set("Accept-Profile", this.schema);
        else this.headers.set("Content-Profile", this.schema);
        if (this.method !== "GET" && this.method !== "HEAD") this.headers.set("Content-Type", "application/json");
        const _fetch = this.fetch;
        let res = _fetch(this.url.toString(), {
          method: this.method,
          headers: this.headers,
          body: JSON.stringify(this.body),
          signal: this.signal
        }).then(async (res$1) => {
          let error = null;
          let data = null;
          let count = null;
          let status = res$1.status;
          let statusText = res$1.statusText;
          if (res$1.ok) {
            var _this$headers$get2, _res$headers$get;
            if (_this.method !== "HEAD") {
              var _this$headers$get;
              const body = await res$1.text();
              if (body === "") {
              } else if (_this.headers.get("Accept") === "text/csv") data = body;
              else if (_this.headers.get("Accept") && ((_this$headers$get = _this.headers.get("Accept")) === null || _this$headers$get === void 0 ? void 0 : _this$headers$get.includes("application/vnd.pgrst.plan+text"))) data = body;
              else data = JSON.parse(body);
            }
            const countHeader = (_this$headers$get2 = _this.headers.get("Prefer")) === null || _this$headers$get2 === void 0 ? void 0 : _this$headers$get2.match(/count=(exact|planned|estimated)/);
            const contentRange = (_res$headers$get = res$1.headers.get("content-range")) === null || _res$headers$get === void 0 ? void 0 : _res$headers$get.split("/");
            if (countHeader && contentRange && contentRange.length > 1) count = parseInt(contentRange[1]);
            if (_this.isMaybeSingle && _this.method === "GET" && Array.isArray(data)) if (data.length > 1) {
              error = {
                code: "PGRST116",
                details: `Results contain ${data.length} rows, application/vnd.pgrst.object+json requires 1 row`,
                hint: null,
                message: "JSON object requested, multiple (or no) rows returned"
              };
              data = null;
              count = null;
              status = 406;
              statusText = "Not Acceptable";
            } else if (data.length === 1) data = data[0];
            else data = null;
          } else {
            var _error$details;
            const body = await res$1.text();
            try {
              error = JSON.parse(body);
              if (Array.isArray(error) && res$1.status === 404) {
                data = [];
                error = null;
                status = 200;
                statusText = "OK";
              }
            } catch (_unused) {
              if (res$1.status === 404 && body === "") {
                status = 204;
                statusText = "No Content";
              } else error = { message: body };
            }
            if (error && _this.isMaybeSingle && (error === null || error === void 0 || (_error$details = error.details) === null || _error$details === void 0 ? void 0 : _error$details.includes("0 rows"))) {
              error = null;
              status = 200;
              statusText = "OK";
            }
            if (error && _this.shouldThrowOnError) throw new PostgrestError(error);
          }
          return {
            error,
            data,
            count,
            status,
            statusText
          };
        });
        if (!this.shouldThrowOnError) res = res.catch((fetchError) => {
          var _fetchError$name2;
          let errorDetails = "";
          let hint = "";
          let code = "";
          const cause = fetchError === null || fetchError === void 0 ? void 0 : fetchError.cause;
          if (cause) {
            var _cause$message, _cause$code, _fetchError$name, _cause$name;
            const causeMessage = (_cause$message = cause === null || cause === void 0 ? void 0 : cause.message) !== null && _cause$message !== void 0 ? _cause$message : "";
            const causeCode = (_cause$code = cause === null || cause === void 0 ? void 0 : cause.code) !== null && _cause$code !== void 0 ? _cause$code : "";
            errorDetails = `${(_fetchError$name = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name !== void 0 ? _fetchError$name : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`;
            errorDetails += `

Caused by: ${(_cause$name = cause === null || cause === void 0 ? void 0 : cause.name) !== null && _cause$name !== void 0 ? _cause$name : "Error"}: ${causeMessage}`;
            if (causeCode) errorDetails += ` (${causeCode})`;
            if (cause === null || cause === void 0 ? void 0 : cause.stack) errorDetails += `
${cause.stack}`;
          } else {
            var _fetchError$stack;
            errorDetails = (_fetchError$stack = fetchError === null || fetchError === void 0 ? void 0 : fetchError.stack) !== null && _fetchError$stack !== void 0 ? _fetchError$stack : "";
          }
          const urlLength = this.url.toString().length;
          if ((fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) === "AbortError" || (fetchError === null || fetchError === void 0 ? void 0 : fetchError.code) === "ABORT_ERR") {
            code = "";
            hint = "Request was aborted (timeout or manual cancellation)";
            if (urlLength > this.urlLengthLimit) hint += `. Note: Your request URL is ${urlLength} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`;
          } else if ((cause === null || cause === void 0 ? void 0 : cause.name) === "HeadersOverflowError" || (cause === null || cause === void 0 ? void 0 : cause.code) === "UND_ERR_HEADERS_OVERFLOW") {
            code = "";
            hint = "HTTP headers exceeded server limits (typically 16KB)";
            if (urlLength > this.urlLengthLimit) hint += `. Your request URL is ${urlLength} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`;
          }
          return {
            error: {
              message: `${(_fetchError$name2 = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name2 !== void 0 ? _fetchError$name2 : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`,
              details: errorDetails,
              hint,
              code
            },
            data: null,
            count: null,
            status: 0,
            statusText: ""
          };
        });
        return res.then(onfulfilled, onrejected);
      }
      /**
      * Override the type of the returned `data`.
      *
      * @typeParam NewResult - The new result type to override with
      * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
      */
      returns() {
        return this;
      }
      /**
      * Override the type of the returned `data` field in the response.
      *
      * @typeParam NewResult - The new type to cast the response data to
      * @typeParam Options - Optional type configuration (defaults to { merge: true })
      * @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true)
      * @example
      * ```typescript
      * // Merge with existing types (default behavior)
      * const query = supabase
      *   .from('users')
      *   .select()
      *   .overrideTypes<{ custom_field: string }>()
      *
      * // Replace existing types completely
      * const replaceQuery = supabase
      *   .from('users')
      *   .select()
      *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
      * ```
      * @returns A PostgrestBuilder instance with the new type
      */
      overrideTypes() {
        return this;
      }
    };
    PostgrestTransformBuilder = class extends PostgrestBuilder {
      /**
      * Perform a SELECT on the query result.
      *
      * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
      * return modified rows. By calling this method, modified rows are returned in
      * `data`.
      *
      * @param columns - The columns to retrieve, separated by commas
      */
      select(columns) {
        let quoted = false;
        const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
          if (/\s/.test(c) && !quoted) return "";
          if (c === '"') quoted = !quoted;
          return c;
        }).join("");
        this.url.searchParams.set("select", cleanedColumns);
        this.headers.append("Prefer", "return=representation");
        return this;
      }
      /**
      * Order the query result by `column`.
      *
      * You can call this method multiple times to order by multiple columns.
      *
      * You can order referenced tables, but it only affects the ordering of the
      * parent table if you use `!inner` in the query.
      *
      * @param column - The column to order by
      * @param options - Named parameters
      * @param options.ascending - If `true`, the result will be in ascending order
      * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
      * `null`s appear last.
      * @param options.referencedTable - Set this to order a referenced table by
      * its columns
      * @param options.foreignTable - Deprecated, use `options.referencedTable`
      * instead
      */
      order(column, { ascending = true, nullsFirst, foreignTable, referencedTable = foreignTable } = {}) {
        const key = referencedTable ? `${referencedTable}.order` : "order";
        const existingOrder = this.url.searchParams.get(key);
        this.url.searchParams.set(key, `${existingOrder ? `${existingOrder},` : ""}${column}.${ascending ? "asc" : "desc"}${nullsFirst === void 0 ? "" : nullsFirst ? ".nullsfirst" : ".nullslast"}`);
        return this;
      }
      /**
      * Limit the query result by `count`.
      *
      * @param count - The maximum number of rows to return
      * @param options - Named parameters
      * @param options.referencedTable - Set this to limit rows of referenced
      * tables instead of the parent table
      * @param options.foreignTable - Deprecated, use `options.referencedTable`
      * instead
      */
      limit(count, { foreignTable, referencedTable = foreignTable } = {}) {
        const key = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
        this.url.searchParams.set(key, `${count}`);
        return this;
      }
      /**
      * Limit the query result by starting at an offset `from` and ending at the offset `to`.
      * Only records within this range are returned.
      * This respects the query order and if there is no order clause the range could behave unexpectedly.
      * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
      * and fourth rows of the query.
      *
      * @param from - The starting index from which to limit the result
      * @param to - The last index to which to limit the result
      * @param options - Named parameters
      * @param options.referencedTable - Set this to limit rows of referenced
      * tables instead of the parent table
      * @param options.foreignTable - Deprecated, use `options.referencedTable`
      * instead
      */
      range(from, to, { foreignTable, referencedTable = foreignTable } = {}) {
        const keyOffset = typeof referencedTable === "undefined" ? "offset" : `${referencedTable}.offset`;
        const keyLimit = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
        this.url.searchParams.set(keyOffset, `${from}`);
        this.url.searchParams.set(keyLimit, `${to - from + 1}`);
        return this;
      }
      /**
      * Set the AbortSignal for the fetch request.
      *
      * @param signal - The AbortSignal to use for the fetch request
      */
      abortSignal(signal) {
        this.signal = signal;
        return this;
      }
      /**
      * Return `data` as a single object instead of an array of objects.
      *
      * Query result must be one row (e.g. using `.limit(1)`), otherwise this
      * returns an error.
      */
      single() {
        this.headers.set("Accept", "application/vnd.pgrst.object+json");
        return this;
      }
      /**
      * Return `data` as a single object instead of an array of objects.
      *
      * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
      * this returns an error.
      */
      maybeSingle() {
        if (this.method === "GET") this.headers.set("Accept", "application/json");
        else this.headers.set("Accept", "application/vnd.pgrst.object+json");
        this.isMaybeSingle = true;
        return this;
      }
      /**
      * Return `data` as a string in CSV format.
      */
      csv() {
        this.headers.set("Accept", "text/csv");
        return this;
      }
      /**
      * Return `data` as an object in [GeoJSON](https://geojson.org) format.
      */
      geojson() {
        this.headers.set("Accept", "application/geo+json");
        return this;
      }
      /**
      * Return `data` as the EXPLAIN plan for the query.
      *
      * You need to enable the
      * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
      * setting before using this method.
      *
      * @param options - Named parameters
      *
      * @param options.analyze - If `true`, the query will be executed and the
      * actual run time will be returned
      *
      * @param options.verbose - If `true`, the query identifier will be returned
      * and `data` will include the output columns of the query
      *
      * @param options.settings - If `true`, include information on configuration
      * parameters that affect query planning
      *
      * @param options.buffers - If `true`, include information on buffer usage
      *
      * @param options.wal - If `true`, include information on WAL record generation
      *
      * @param options.format - The format of the output, can be `"text"` (default)
      * or `"json"`
      */
      explain({ analyze = false, verbose = false, settings = false, buffers = false, wal = false, format = "text" } = {}) {
        var _this$headers$get;
        const options = [
          analyze ? "analyze" : null,
          verbose ? "verbose" : null,
          settings ? "settings" : null,
          buffers ? "buffers" : null,
          wal ? "wal" : null
        ].filter(Boolean).join("|");
        const forMediatype = (_this$headers$get = this.headers.get("Accept")) !== null && _this$headers$get !== void 0 ? _this$headers$get : "application/json";
        this.headers.set("Accept", `application/vnd.pgrst.plan+${format}; for="${forMediatype}"; options=${options};`);
        if (format === "json") return this;
        else return this;
      }
      /**
      * Rollback the query.
      *
      * `data` will still be returned, but the query is not committed.
      */
      rollback() {
        this.headers.append("Prefer", "tx=rollback");
        return this;
      }
      /**
      * Override the type of the returned `data`.
      *
      * @typeParam NewResult - The new result type to override with
      * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
      */
      returns() {
        return this;
      }
      /**
      * Set the maximum number of rows that can be affected by the query.
      * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
      *
      * @param value - The maximum number of rows that can be affected
      */
      maxAffected(value) {
        this.headers.append("Prefer", "handling=strict");
        this.headers.append("Prefer", `max-affected=${value}`);
        return this;
      }
    };
    PostgrestReservedCharsRegexp = /* @__PURE__ */ new RegExp("[,()]");
    PostgrestFilterBuilder = class extends PostgrestTransformBuilder {
      /**
      * Match only rows where `column` is equal to `value`.
      *
      * To check if the value of `column` is NULL, you should use `.is()` instead.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      eq(column, value) {
        this.url.searchParams.append(column, `eq.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is not equal to `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      neq(column, value) {
        this.url.searchParams.append(column, `neq.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is greater than `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      gt(column, value) {
        this.url.searchParams.append(column, `gt.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is greater than or equal to `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      gte(column, value) {
        this.url.searchParams.append(column, `gte.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is less than `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      lt(column, value) {
        this.url.searchParams.append(column, `lt.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is less than or equal to `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      lte(column, value) {
        this.url.searchParams.append(column, `lte.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` matches `pattern` case-sensitively.
      *
      * @param column - The column to filter on
      * @param pattern - The pattern to match with
      */
      like(column, pattern) {
        this.url.searchParams.append(column, `like.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` matches all of `patterns` case-sensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      likeAllOf(column, patterns) {
        this.url.searchParams.append(column, `like(all).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches any of `patterns` case-sensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      likeAnyOf(column, patterns) {
        this.url.searchParams.append(column, `like(any).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches `pattern` case-insensitively.
      *
      * @param column - The column to filter on
      * @param pattern - The pattern to match with
      */
      ilike(column, pattern) {
        this.url.searchParams.append(column, `ilike.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` matches all of `patterns` case-insensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      ilikeAllOf(column, patterns) {
        this.url.searchParams.append(column, `ilike(all).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches any of `patterns` case-insensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      ilikeAnyOf(column, patterns) {
        this.url.searchParams.append(column, `ilike(any).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches the PostgreSQL regex `pattern`
      * case-sensitively (using the `~` operator).
      *
      * @param column - The column to filter on
      * @param pattern - The PostgreSQL regular expression pattern to match with
      */
      regexMatch(column, pattern) {
        this.url.searchParams.append(column, `match.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` matches the PostgreSQL regex `pattern`
      * case-insensitively (using the `~*` operator).
      *
      * @param column - The column to filter on
      * @param pattern - The PostgreSQL regular expression pattern to match with
      */
      regexIMatch(column, pattern) {
        this.url.searchParams.append(column, `imatch.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` IS `value`.
      *
      * For non-boolean columns, this is only relevant for checking if the value of
      * `column` is NULL by setting `value` to `null`.
      *
      * For boolean columns, you can also set `value` to `true` or `false` and it
      * will behave the same way as `.eq()`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      is(column, value) {
        this.url.searchParams.append(column, `is.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` IS DISTINCT FROM `value`.
      *
      * Unlike `.neq()`, this treats `NULL` as a comparable value. Two `NULL` values
      * are considered equal (not distinct), and comparing `NULL` with any non-NULL
      * value returns true (distinct).
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      isDistinct(column, value) {
        this.url.searchParams.append(column, `isdistinct.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is included in the `values` array.
      *
      * @param column - The column to filter on
      * @param values - The values array to filter with
      */
      in(column, values) {
        const cleanedValues = Array.from(new Set(values)).map((s) => {
          if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
          else return `${s}`;
        }).join(",");
        this.url.searchParams.append(column, `in.(${cleanedValues})`);
        return this;
      }
      /**
      * Match only rows where `column` is NOT included in the `values` array.
      *
      * @param column - The column to filter on
      * @param values - The values array to filter with
      */
      notIn(column, values) {
        const cleanedValues = Array.from(new Set(values)).map((s) => {
          if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
          else return `${s}`;
        }).join(",");
        this.url.searchParams.append(column, `not.in.(${cleanedValues})`);
        return this;
      }
      /**
      * Only relevant for jsonb, array, and range columns. Match only rows where
      * `column` contains every element appearing in `value`.
      *
      * @param column - The jsonb, array, or range column to filter on
      * @param value - The jsonb, array, or range value to filter with
      */
      contains(column, value) {
        if (typeof value === "string") this.url.searchParams.append(column, `cs.${value}`);
        else if (Array.isArray(value)) this.url.searchParams.append(column, `cs.{${value.join(",")}}`);
        else this.url.searchParams.append(column, `cs.${JSON.stringify(value)}`);
        return this;
      }
      /**
      * Only relevant for jsonb, array, and range columns. Match only rows where
      * every element appearing in `column` is contained by `value`.
      *
      * @param column - The jsonb, array, or range column to filter on
      * @param value - The jsonb, array, or range value to filter with
      */
      containedBy(column, value) {
        if (typeof value === "string") this.url.searchParams.append(column, `cd.${value}`);
        else if (Array.isArray(value)) this.url.searchParams.append(column, `cd.{${value.join(",")}}`);
        else this.url.searchParams.append(column, `cd.${JSON.stringify(value)}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is greater than any element in `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeGt(column, range) {
        this.url.searchParams.append(column, `sr.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is either contained in `range` or greater than any element in
      * `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeGte(column, range) {
        this.url.searchParams.append(column, `nxl.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is less than any element in `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeLt(column, range) {
        this.url.searchParams.append(column, `sl.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is either contained in `range` or less than any element in
      * `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeLte(column, range) {
        this.url.searchParams.append(column, `nxr.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where `column` is
      * mutually exclusive to `range` and there can be no element between the two
      * ranges.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeAdjacent(column, range) {
        this.url.searchParams.append(column, `adj.${range}`);
        return this;
      }
      /**
      * Only relevant for array and range columns. Match only rows where
      * `column` and `value` have an element in common.
      *
      * @param column - The array or range column to filter on
      * @param value - The array or range value to filter with
      */
      overlaps(column, value) {
        if (typeof value === "string") this.url.searchParams.append(column, `ov.${value}`);
        else this.url.searchParams.append(column, `ov.{${value.join(",")}}`);
        return this;
      }
      /**
      * Only relevant for text and tsvector columns. Match only rows where
      * `column` matches the query string in `query`.
      *
      * @param column - The text or tsvector column to filter on
      * @param query - The query text to match with
      * @param options - Named parameters
      * @param options.config - The text search configuration to use
      * @param options.type - Change how the `query` text is interpreted
      */
      textSearch(column, query, { config, type } = {}) {
        let typePart = "";
        if (type === "plain") typePart = "pl";
        else if (type === "phrase") typePart = "ph";
        else if (type === "websearch") typePart = "w";
        const configPart = config === void 0 ? "" : `(${config})`;
        this.url.searchParams.append(column, `${typePart}fts${configPart}.${query}`);
        return this;
      }
      /**
      * Match only rows where each column in `query` keys is equal to its
      * associated value. Shorthand for multiple `.eq()`s.
      *
      * @param query - The object to filter with, with column names as keys mapped
      * to their filter values
      */
      match(query) {
        Object.entries(query).forEach(([column, value]) => {
          this.url.searchParams.append(column, `eq.${value}`);
        });
        return this;
      }
      /**
      * Match only rows which doesn't satisfy the filter.
      *
      * Unlike most filters, `opearator` and `value` are used as-is and need to
      * follow [PostgREST
      * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
      * to make sure they are properly sanitized.
      *
      * @param column - The column to filter on
      * @param operator - The operator to be negated to filter with, following
      * PostgREST syntax
      * @param value - The value to filter with, following PostgREST syntax
      */
      not(column, operator, value) {
        this.url.searchParams.append(column, `not.${operator}.${value}`);
        return this;
      }
      /**
      * Match only rows which satisfy at least one of the filters.
      *
      * Unlike most filters, `filters` is used as-is and needs to follow [PostgREST
      * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
      * to make sure it's properly sanitized.
      *
      * It's currently not possible to do an `.or()` filter across multiple tables.
      *
      * @param filters - The filters to use, following PostgREST syntax
      * @param options - Named parameters
      * @param options.referencedTable - Set this to filter on referenced tables
      * instead of the parent table
      * @param options.foreignTable - Deprecated, use `referencedTable` instead
      */
      or(filters, { foreignTable, referencedTable = foreignTable } = {}) {
        const key = referencedTable ? `${referencedTable}.or` : "or";
        this.url.searchParams.append(key, `(${filters})`);
        return this;
      }
      /**
      * Match only rows which satisfy the filter. This is an escape hatch - you
      * should use the specific filter methods wherever possible.
      *
      * Unlike most filters, `opearator` and `value` are used as-is and need to
      * follow [PostgREST
      * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
      * to make sure they are properly sanitized.
      *
      * @param column - The column to filter on
      * @param operator - The operator to filter with, following PostgREST syntax
      * @param value - The value to filter with, following PostgREST syntax
      */
      filter(column, operator, value) {
        this.url.searchParams.append(column, `${operator}.${value}`);
        return this;
      }
    };
    PostgrestQueryBuilder = class {
      /**
      * Creates a query builder scoped to a Postgres table or view.
      *
      * @example
      * ```ts
      * import PostgrestQueryBuilder from '@supabase/postgrest-js'
      *
      * const query = new PostgrestQueryBuilder(
      *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
      *   { headers: { apikey: 'public-anon-key' } }
      * )
      * ```
      */
      constructor(url, { headers = {}, schema, fetch: fetch$1, urlLengthLimit = 8e3 }) {
        this.url = url;
        this.headers = new Headers(headers);
        this.schema = schema;
        this.fetch = fetch$1;
        this.urlLengthLimit = urlLengthLimit;
      }
      /**
      * Clone URL and headers to prevent shared state between operations.
      */
      cloneRequestState() {
        return {
          url: new URL(this.url.toString()),
          headers: new Headers(this.headers)
        };
      }
      /**
      * Perform a SELECT query on the table or view.
      *
      * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
      *
      * @param options - Named parameters
      *
      * @param options.head - When set to `true`, `data` will not be returned.
      * Useful if you only need the count.
      *
      * @param options.count - Count algorithm to use to count rows in the table or view.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @remarks
      * When using `count` with `.range()` or `.limit()`, the returned `count` is the total number of rows
      * that match your filters, not the number of rows in the current page. Use this to build pagination UI.
      
      * - By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in your project's [API settings](/dashboard/project/_/settings/api). It's recommended that you keep it low to limit the payload size of accidental or malicious requests. You can use `range()` queries to paginate through your data.
      * - `select()` can be combined with [Filters](/docs/reference/javascript/using-filters)
      * - `select()` can be combined with [Modifiers](/docs/reference/javascript/using-modifiers)
      * - `apikey` is a reserved keyword if you're using the [Supabase Platform](/docs/guides/platform) and [should be avoided as a column name](https://github.com/supabase/supabase/issues/5465). *
      * @category Database
      *
      * @example Getting your data
      * ```js
      * const { data, error } = await supabase
      *   .from('characters')
      *   .select()
      * ```
      *
      * @exampleSql Getting your data
      * ```sql
      * create table
      *   characters (id int8 primary key, name text);
      *
      * insert into
      *   characters (id, name)
      * values
      *   (1, 'Harry'),
      *   (2, 'Frodo'),
      *   (3, 'Katniss');
      * ```
      *
      * @exampleResponse Getting your data
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": 1,
      *       "name": "Harry"
      *     },
      *     {
      *       "id": 2,
      *       "name": "Frodo"
      *     },
      *     {
      *       "id": 3,
      *       "name": "Katniss"
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @example Selecting specific columns
      * ```js
      * const { data, error } = await supabase
      *   .from('characters')
      *   .select('name')
      * ```
      *
      * @exampleSql Selecting specific columns
      * ```sql
      * create table
      *   characters (id int8 primary key, name text);
      *
      * insert into
      *   characters (id, name)
      * values
      *   (1, 'Frodo'),
      *   (2, 'Harry'),
      *   (3, 'Katniss');
      * ```
      *
      * @exampleResponse Selecting specific columns
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "Frodo"
      *     },
      *     {
      *       "name": "Harry"
      *     },
      *     {
      *       "name": "Katniss"
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Query referenced tables
      * If your database has foreign key relationships, you can query related tables too.
      *
      * @example Query referenced tables
      * ```js
      * const { data, error } = await supabase
      *   .from('orchestral_sections')
      *   .select(`
      *     name,
      *     instruments (
      *       name
      *     )
      *   `)
      * ```
      *
      * @exampleSql Query referenced tables
      * ```sql
      * create table
      *   orchestral_sections (id int8 primary key, name text);
      * create table
      *   instruments (
      *     id int8 primary key,
      *     section_id int8 not null references orchestral_sections,
      *     name text
      *   );
      *
      * insert into
      *   orchestral_sections (id, name)
      * values
      *   (1, 'strings'),
      *   (2, 'woodwinds');
      * insert into
      *   instruments (id, section_id, name)
      * values
      *   (1, 2, 'flute'),
      *   (2, 1, 'violin');
      * ```
      *
      * @exampleResponse Query referenced tables
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "strings",
      *       "instruments": [
      *         {
      *           "name": "violin"
      *         }
      *       ]
      *     },
      *     {
      *       "name": "woodwinds",
      *       "instruments": [
      *         {
      *           "name": "flute"
      *         }
      *       ]
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Query referenced tables with spaces in their names
      * If your table name contains spaces, you must use double quotes in the `select` statement to reference the table.
      *
      * @example Query referenced tables with spaces in their names
      * ```js
      * const { data, error } = await supabase
      *   .from('orchestral sections')
      *   .select(`
      *     name,
      *     "musical instruments" (
      *       name
      *     )
      *   `)
      * ```
      *
      * @exampleSql Query referenced tables with spaces in their names
      * ```sql
      * create table
      *   "orchestral sections" (id int8 primary key, name text);
      * create table
      *   "musical instruments" (
      *     id int8 primary key,
      *     section_id int8 not null references "orchestral sections",
      *     name text
      *   );
      *
      * insert into
      *   "orchestral sections" (id, name)
      * values
      *   (1, 'strings'),
      *   (2, 'woodwinds');
      * insert into
      *   "musical instruments" (id, section_id, name)
      * values
      *   (1, 2, 'flute'),
      *   (2, 1, 'violin');
      * ```
      *
      * @exampleResponse Query referenced tables with spaces in their names
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "strings",
      *       "musical instruments": [
      *         {
      *           "name": "violin"
      *         }
      *       ]
      *     },
      *     {
      *       "name": "woodwinds",
      *       "musical instruments": [
      *         {
      *           "name": "flute"
      *         }
      *       ]
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Query referenced tables through a join table
      * If you're in a situation where your tables are **NOT** directly
      * related, but instead are joined by a _join table_, you can still use
      * the `select()` method to query the related data. The join table needs
      * to have the foreign keys as part of its composite primary key.
      *
      * @example Query referenced tables through a join table
      * ```ts
      * const { data, error } = await supabase
      *   .from('users')
      *   .select(`
      *     name,
      *     teams (
      *       name
      *     )
      *   `)
      *   
      * ```
      *
      * @exampleSql Query referenced tables through a join table
      * ```sql
      * create table
      *   users (
      *     id int8 primary key,
      *     name text
      *   );
      * create table
      *   teams (
      *     id int8 primary key,
      *     name text
      *   );
      * -- join table
      * create table
      *   users_teams (
      *     user_id int8 not null references users,
      *     team_id int8 not null references teams,
      *     -- both foreign keys must be part of a composite primary key
      *     primary key (user_id, team_id)
      *   );
      *
      * insert into
      *   users (id, name)
      * values
      *   (1, 'Kiran'),
      *   (2, 'Evan');
      * insert into
      *   teams (id, name)
      * values
      *   (1, 'Green'),
      *   (2, 'Blue');
      * insert into
      *   users_teams (user_id, team_id)
      * values
      *   (1, 1),
      *   (1, 2),
      *   (2, 2);
      * ```
      *
      * @exampleResponse Query referenced tables through a join table
      * ```json
      *   {
      *     "data": [
      *       {
      *         "name": "Kiran",
      *         "teams": [
      *           {
      *             "name": "Green"
      *           },
      *           {
      *             "name": "Blue"
      *           }
      *         ]
      *       },
      *       {
      *         "name": "Evan",
      *         "teams": [
      *           {
      *             "name": "Blue"
      *           }
      *         ]
      *       }
      *     ],
      *     "status": 200,
      *     "statusText": "OK"
      *   }
      *   
      * ```
      *
      * @exampleDescription Query the same referenced table multiple times
      * If you need to query the same referenced table twice, use the name of the
      * joined column to identify which join to use. You can also give each
      * column an alias.
      *
      * @example Query the same referenced table multiple times
      * ```ts
      * const { data, error } = await supabase
      *   .from('messages')
      *   .select(`
      *     content,
      *     from:sender_id(name),
      *     to:receiver_id(name)
      *   `)
      *
      * // To infer types, use the name of the table (in this case `users`) and
      * // the name of the foreign key constraint.
      * const { data, error } = await supabase
      *   .from('messages')
      *   .select(`
      *     content,
      *     from:users!messages_sender_id_fkey(name),
      *     to:users!messages_receiver_id_fkey(name)
      *   `)
      * ```
      *
      * @exampleSql Query the same referenced table multiple times
      * ```sql
      *  create table
      *  users (id int8 primary key, name text);
      *
      *  create table
      *    messages (
      *      sender_id int8 not null references users,
      *      receiver_id int8 not null references users,
      *      content text
      *    );
      *
      *  insert into
      *    users (id, name)
      *  values
      *    (1, 'Kiran'),
      *    (2, 'Evan');
      *
      *  insert into
      *    messages (sender_id, receiver_id, content)
      *  values
      *    (1, 2, '👋');
      *  ```
      * ```
      *
      * @exampleResponse Query the same referenced table multiple times
      * ```json
      * {
      *   "data": [
      *     {
      *       "content": "👋",
      *       "from": {
      *         "name": "Kiran"
      *       },
      *       "to": {
      *         "name": "Evan"
      *       }
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Query nested foreign tables through a join table
      * You can use the result of a joined table to gather data in
      * another foreign table. With multiple references to the same foreign
      * table you must specify the column on which to conduct the join.
      *
      * @example Query nested foreign tables through a join table
      * ```ts
      *   const { data, error } = await supabase
      *     .from('games')
      *     .select(`
      *       game_id:id,
      *       away_team:teams!games_away_team_fkey (
      *         users (
      *           id,
      *           name
      *         )
      *       )
      *     `)
      *   
      * ```
      *
      * @exampleSql Query nested foreign tables through a join table
      * ```sql
      * ```sql
      * create table
      *   users (
      *     id int8 primary key,
      *     name text
      *   );
      * create table
      *   teams (
      *     id int8 primary key,
      *     name text
      *   );
      * -- join table
      * create table
      *   users_teams (
      *     user_id int8 not null references users,
      *     team_id int8 not null references teams,
      *
      *     primary key (user_id, team_id)
      *   );
      * create table
      *   games (
      *     id int8 primary key,
      *     home_team int8 not null references teams,
      *     away_team int8 not null references teams,
      *     name text
      *   );
      *
      * insert into users (id, name)
      * values
      *   (1, 'Kiran'),
      *   (2, 'Evan');
      * insert into
      *   teams (id, name)
      * values
      *   (1, 'Green'),
      *   (2, 'Blue');
      * insert into
      *   users_teams (user_id, team_id)
      * values
      *   (1, 1),
      *   (1, 2),
      *   (2, 2);
      * insert into
      *   games (id, home_team, away_team, name)
      * values
      *   (1, 1, 2, 'Green vs Blue'),
      *   (2, 2, 1, 'Blue vs Green');
      * ```
      *
      * @exampleResponse Query nested foreign tables through a join table
      * ```json
      *   {
      *     "data": [
      *       {
      *         "game_id": 1,
      *         "away_team": {
      *           "users": [
      *             {
      *               "id": 1,
      *               "name": "Kiran"
      *             },
      *             {
      *               "id": 2,
      *               "name": "Evan"
      *             }
      *           ]
      *         }
      *       },
      *       {
      *         "game_id": 2,
      *         "away_team": {
      *           "users": [
      *             {
      *               "id": 1,
      *               "name": "Kiran"
      *             }
      *           ]
      *         }
      *       }
      *     ],
      *     "status": 200,
      *     "statusText": "OK"
      *   }
      *   
      * ```
      *
      * @exampleDescription Filtering through referenced tables
      * If the filter on a referenced table's column is not satisfied, the referenced
      * table returns `[]` or `null` but the parent table is not filtered out.
      * If you want to filter out the parent table rows, use the `!inner` hint
      *
      * @example Filtering through referenced tables
      * ```ts
      * const { data, error } = await supabase
      *   .from('instruments')
      *   .select('name, orchestral_sections(*)')
      *   .eq('orchestral_sections.name', 'percussion')
      * ```
      *
      * @exampleSql Filtering through referenced tables
      * ```sql
      * create table
      *   orchestral_sections (id int8 primary key, name text);
      * create table
      *   instruments (
      *     id int8 primary key,
      *     section_id int8 not null references orchestral_sections,
      *     name text
      *   );
      *
      * insert into
      *   orchestral_sections (id, name)
      * values
      *   (1, 'strings'),
      *   (2, 'woodwinds');
      * insert into
      *   instruments (id, section_id, name)
      * values
      *   (1, 2, 'flute'),
      *   (2, 1, 'violin');
      * ```
      *
      * @exampleResponse Filtering through referenced tables
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "flute",
      *       "orchestral_sections": null
      *     },
      *     {
      *       "name": "violin",
      *       "orchestral_sections": null
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Querying referenced table with count
      * You can get the number of rows in a related table by using the
      * **count** property.
      *
      * @example Querying referenced table with count
      * ```ts
      * const { data, error } = await supabase
      *   .from('orchestral_sections')
      *   .select(`*, instruments(count)`)
      * ```
      *
      * @exampleSql Querying referenced table with count
      * ```sql
      * create table orchestral_sections (
      *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
      *   "name" text
      * );
      *
      * create table characters (
      *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
      *   "name" text,
      *   "section_id" "uuid" references public.orchestral_sections on delete cascade
      * );
      *
      * with section as (
      *   insert into orchestral_sections (name)
      *   values ('strings') returning id
      * )
      * insert into instruments (name, section_id) values
      * ('violin', (select id from section)),
      * ('viola', (select id from section)),
      * ('cello', (select id from section)),
      * ('double bass', (select id from section));
      * ```
      *
      * @exampleResponse Querying referenced table with count
      * ```json
      * [
      *   {
      *     "id": "693694e7-d993-4360-a6d7-6294e325d9b6",
      *     "name": "strings",
      *     "instruments": [
      *       {
      *         "count": 4
      *       }
      *     ]
      *   }
      * ]
      * ```
      *
      * @exampleDescription Querying with count option
      * You can get the number of rows by using the
      * [count](/docs/reference/javascript/select#parameters) option.
      *
      * @example Querying with count option
      * ```ts
      * const { count, error } = await supabase
      *   .from('characters')
      *   .select('*', { count: 'exact', head: true })
      * ```
      *
      * @exampleSql Querying with count option
      * ```sql
      * create table
      *   characters (id int8 primary key, name text);
      *
      * insert into
      *   characters (id, name)
      * values
      *   (1, 'Luke'),
      *   (2, 'Leia'),
      *   (3, 'Han');
      * ```
      *
      * @exampleResponse Querying with count option
      * ```json
      * {
      *   "count": 3,
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Querying JSON data
      * You can select and filter data inside of
      * [JSON](/docs/guides/database/json) columns. Postgres offers some
      * [operators](/docs/guides/database/json#query-the-jsonb-data) for
      * querying JSON data.
      *
      * @example Querying JSON data
      * ```ts
      * const { data, error } = await supabase
      *   .from('users')
      *   .select(`
      *     id, name,
      *     address->city
      *   `)
      * ```
      *
      * @exampleSql Querying JSON data
      * ```sql
      * create table
      *   users (
      *     id int8 primary key,
      *     name text,
      *     address jsonb
      *   );
      *
      * insert into
      *   users (id, name, address)
      * values
      *   (1, 'Frodo', '{"city":"Hobbiton"}');
      * ```
      *
      * @exampleResponse Querying JSON data
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": 1,
      *       "name": "Frodo",
      *       "city": "Hobbiton"
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Querying referenced table with inner join
      * If you don't want to return the referenced table contents, you can leave the parenthesis empty.
      * Like `.select('name, orchestral_sections!inner()')`.
      *
      * @example Querying referenced table with inner join
      * ```ts
      * const { data, error } = await supabase
      *   .from('instruments')
      *   .select('name, orchestral_sections!inner(name)')
      *   .eq('orchestral_sections.name', 'woodwinds')
      *   .limit(1)
      * ```
      *
      * @exampleSql Querying referenced table with inner join
      * ```sql
      * create table orchestral_sections (
      *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
      *   "name" text
      * );
      *
      * create table instruments (
      *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
      *   "name" text,
      *   "section_id" "uuid" references public.orchestral_sections on delete cascade
      * );
      *
      * with section as (
      *   insert into orchestral_sections (name)
      *   values ('woodwinds') returning id
      * )
      * insert into instruments (name, section_id) values
      * ('flute', (select id from section)),
      * ('clarinet', (select id from section)),
      * ('bassoon', (select id from section)),
      * ('piccolo', (select id from section));
      * ```
      *
      * @exampleResponse Querying referenced table with inner join
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "flute",
      *       "orchestral_sections": {"name": "woodwinds"}
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Switching schemas per query
      * In addition to setting the schema during initialization, you can also switch schemas on a per-query basis.
      * Make sure you've set up your [database privileges and API settings](/docs/guides/api/using-custom-schemas).
      *
      * @example Switching schemas per query
      * ```ts
      * const { data, error } = await supabase
      *   .schema('myschema')
      *   .from('mytable')
      *   .select()
      * ```
      *
      * @exampleSql Switching schemas per query
      * ```sql
      * create schema myschema;
      *
      * create table myschema.mytable (
      *   id uuid primary key default gen_random_uuid(),
      *   data text
      * );
      *
      * insert into myschema.mytable (data) values ('mydata');
      * ```
      *
      * @exampleResponse Switching schemas per query
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": "4162e008-27b0-4c0f-82dc-ccaeee9a624d",
      *       "data": "mydata"
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      */
      select(columns, options) {
        const { head: head2 = false, count } = options !== null && options !== void 0 ? options : {};
        const method = head2 ? "HEAD" : "GET";
        let quoted = false;
        const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
          if (/\s/.test(c) && !quoted) return "";
          if (c === '"') quoted = !quoted;
          return c;
        }).join("");
        const { url, headers } = this.cloneRequestState();
        url.searchParams.set("select", cleanedColumns);
        if (count) headers.append("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          fetch: this.fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
      /**
      * Perform an INSERT into the table or view.
      *
      * By default, inserted rows are not returned. To return it, chain the call
      * with `.select()`.
      *
      * @param values - The values to insert. Pass an object to insert a single row
      * or an array to insert multiple rows.
      *
      * @param options - Named parameters
      *
      * @param options.count - Count algorithm to use to count inserted rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @param options.defaultToNull - Make missing fields default to `null`.
      * Otherwise, use the default value for the column. Only applies for bulk
      * inserts.
      *
      * @category Database
      *
      * @example Create a record
      * ```ts
      * const { error } = await supabase
      *   .from('countries')
      *   .insert({ id: 1, name: 'Mordor' })
      * ```
      *
      * @exampleSql Create a record
      * ```sql
      * create table
      *   countries (id int8 primary key, name text);
      * ```
      *
      * @exampleResponse Create a record
      * ```json
      * {
      *   "status": 201,
      *   "statusText": "Created"
      * }
      * ```
      *
      * @example Create a record and return it
      * ```ts
      * const { data, error } = await supabase
      *   .from('countries')
      *   .insert({ id: 1, name: 'Mordor' })
      *   .select()
      * ```
      *
      * @exampleSql Create a record and return it
      * ```sql
      * create table
      *   countries (id int8 primary key, name text);
      * ```
      *
      * @exampleResponse Create a record and return it
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": 1,
      *       "name": "Mordor"
      *     }
      *   ],
      *   "status": 201,
      *   "statusText": "Created"
      * }
      * ```
      *
      * @exampleDescription Bulk create
      * A bulk create operation is handled in a single transaction.
      * If any of the inserts fail, none of the rows are inserted.
      *
      * @example Bulk create
      * ```ts
      * const { error } = await supabase
      *   .from('countries')
      *   .insert([
      *     { id: 1, name: 'Mordor' },
      *     { id: 1, name: 'The Shire' },
      *   ])
      * ```
      *
      * @exampleSql Bulk create
      * ```sql
      * create table
      *   countries (id int8 primary key, name text);
      * ```
      *
      * @exampleResponse Bulk create
      * ```json
      * {
      *   "error": {
      *     "code": "23505",
      *     "details": "Key (id)=(1) already exists.",
      *     "hint": null,
      *     "message": "duplicate key value violates unique constraint \"countries_pkey\""
      *   },
      *   "status": 409,
      *   "statusText": "Conflict"
      * }
      * ```
      */
      insert(values, { count, defaultToNull = true } = {}) {
        var _this$fetch;
        const method = "POST";
        const { url, headers } = this.cloneRequestState();
        if (count) headers.append("Prefer", `count=${count}`);
        if (!defaultToNull) headers.append("Prefer", `missing=default`);
        if (Array.isArray(values)) {
          const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
          if (columns.length > 0) {
            const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
            url.searchParams.set("columns", uniqueColumns.join(","));
          }
        }
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          body: values,
          fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
      /**
      * Perform an UPSERT on the table or view. Depending on the column(s) passed
      * to `onConflict`, `.upsert()` allows you to perform the equivalent of
      * `.insert()` if a row with the corresponding `onConflict` columns doesn't
      * exist, or if it does exist, perform an alternative action depending on
      * `ignoreDuplicates`.
      *
      * By default, upserted rows are not returned. To return it, chain the call
      * with `.select()`.
      *
      * @param values - The values to upsert with. Pass an object to upsert a
      * single row or an array to upsert multiple rows.
      *
      * @param options - Named parameters
      *
      * @param options.onConflict - Comma-separated UNIQUE column(s) to specify how
      * duplicate rows are determined. Two rows are duplicates if all the
      * `onConflict` columns are equal.
      *
      * @param options.ignoreDuplicates - If `true`, duplicate rows are ignored. If
      * `false`, duplicate rows are merged with existing rows.
      *
      * @param options.count - Count algorithm to use to count upserted rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @param options.defaultToNull - Make missing fields default to `null`.
      * Otherwise, use the default value for the column. This only applies when
      * inserting new rows, not when merging with existing rows under
      * `ignoreDuplicates: false`. This also only applies when doing bulk upserts.
      *
      * @example Upsert a single row using a unique key
      * ```ts
      * // Upserting a single row, overwriting based on the 'username' unique column
      * const { data, error } = await supabase
      *   .from('users')
      *   .upsert({ username: 'supabot' }, { onConflict: 'username' })
      *
      * // Example response:
      * // {
      * //   data: [
      * //     { id: 4, message: 'bar', username: 'supabot' }
      * //   ],
      * //   error: null
      * // }
      * ```
      *
      * @example Upsert with conflict resolution and exact row counting
      * ```ts
      * // Upserting and returning exact count
      * const { data, error, count } = await supabase
      *   .from('users')
      *   .upsert(
      *     {
      *       id: 3,
      *       message: 'foo',
      *       username: 'supabot'
      *     },
      *     {
      *       onConflict: 'username',
      *       count: 'exact'
      *     }
      *   )
      *
      * // Example response:
      * // {
      * //   data: [
      * //     {
      * //       id: 42,
      * //       handle: "saoirse",
      * //       display_name: "Saoirse"
      * //     }
      * //   ],
      * //   count: 1,
      * //   error: null
      * // }
      * ```
      *
      * @category Database
      *
      * @remarks
      * - Primary keys must be included in `values` to use upsert.
      *
      * @example Upsert your data
      * ```ts
      * const { data, error } = await supabase
      *   .from('instruments')
      *   .upsert({ id: 1, name: 'piano' })
      *   .select()
      * ```
      *
      * @exampleSql Upsert your data
      * ```sql
      * create table
      *   instruments (id int8 primary key, name text);
      *
      * insert into
      *   instruments (id, name)
      * values
      *   (1, 'harpsichord');
      * ```
      *
      * @exampleResponse Upsert your data
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": 1,
      *       "name": "piano"
      *     }
      *   ],
      *   "status": 201,
      *   "statusText": "Created"
      * }
      * ```
      *
      * @example Bulk Upsert your data
      * ```ts
      * const { data, error } = await supabase
      *   .from('instruments')
      *   .upsert([
      *     { id: 1, name: 'piano' },
      *     { id: 2, name: 'harp' },
      *   ])
      *   .select()
      * ```
      *
      * @exampleSql Bulk Upsert your data
      * ```sql
      * create table
      *   instruments (id int8 primary key, name text);
      *
      * insert into
      *   instruments (id, name)
      * values
      *   (1, 'harpsichord');
      * ```
      *
      * @exampleResponse Bulk Upsert your data
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": 1,
      *       "name": "piano"
      *     },
      *     {
      *       "id": 2,
      *       "name": "harp"
      *     }
      *   ],
      *   "status": 201,
      *   "statusText": "Created"
      * }
      * ```
      *
      * @exampleDescription Upserting into tables with constraints
      * In the following query, `upsert()` implicitly uses the `id`
      * (primary key) column to determine conflicts. If there is no existing
      * row with the same `id`, `upsert()` inserts a new row, which
      * will fail in this case as there is already a row with `handle` `"saoirse"`.
      * Using the `onConflict` option, you can instruct `upsert()` to use
      * another column with a unique constraint to determine conflicts.
      *
      * @example Upserting into tables with constraints
      * ```ts
      * const { data, error } = await supabase
      *   .from('users')
      *   .upsert({ id: 42, handle: 'saoirse', display_name: 'Saoirse' })
      *   .select()
      * ```
      *
      * @exampleSql Upserting into tables with constraints
      * ```sql
      * create table
      *   users (
      *     id int8 generated by default as identity primary key,
      *     handle text not null unique,
      *     display_name text
      *   );
      *
      * insert into
      *   users (id, handle, display_name)
      * values
      *   (1, 'saoirse', null);
      * ```
      *
      * @exampleResponse Upserting into tables with constraints
      * ```json
      * {
      *   "error": {
      *     "code": "23505",
      *     "details": "Key (handle)=(saoirse) already exists.",
      *     "hint": null,
      *     "message": "duplicate key value violates unique constraint \"users_handle_key\""
      *   },
      *   "status": 409,
      *   "statusText": "Conflict"
      * }
      * ```
      */
      upsert(values, { onConflict, ignoreDuplicates = false, count, defaultToNull = true } = {}) {
        var _this$fetch2;
        const method = "POST";
        const { url, headers } = this.cloneRequestState();
        headers.append("Prefer", `resolution=${ignoreDuplicates ? "ignore" : "merge"}-duplicates`);
        if (onConflict !== void 0) url.searchParams.set("on_conflict", onConflict);
        if (count) headers.append("Prefer", `count=${count}`);
        if (!defaultToNull) headers.append("Prefer", "missing=default");
        if (Array.isArray(values)) {
          const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
          if (columns.length > 0) {
            const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
            url.searchParams.set("columns", uniqueColumns.join(","));
          }
        }
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          body: values,
          fetch: (_this$fetch2 = this.fetch) !== null && _this$fetch2 !== void 0 ? _this$fetch2 : fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
      /**
      * Perform an UPDATE on the table or view.
      *
      * By default, updated rows are not returned. To return it, chain the call
      * with `.select()` after filters.
      *
      * @param values - The values to update with
      *
      * @param options - Named parameters
      *
      * @param options.count - Count algorithm to use to count updated rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @category Database
      *
      * @remarks
      * - `update()` should always be combined with [Filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to update.
      *
      * @example Updating your data
      * ```ts
      * const { error } = await supabase
      *   .from('instruments')
      *   .update({ name: 'piano' })
      *   .eq('id', 1)
      * ```
      *
      * @exampleSql Updating your data
      * ```sql
      * create table
      *   instruments (id int8 primary key, name text);
      *
      * insert into
      *   instruments (id, name)
      * values
      *   (1, 'harpsichord');
      * ```
      *
      * @exampleResponse Updating your data
      * ```json
      * {
      *   "status": 204,
      *   "statusText": "No Content"
      * }
      * ```
      *
      * @example Update a record and return it
      * ```ts
      * const { data, error } = await supabase
      *   .from('instruments')
      *   .update({ name: 'piano' })
      *   .eq('id', 1)
      *   .select()
      * ```
      *
      * @exampleSql Update a record and return it
      * ```sql
      * create table
      *   instruments (id int8 primary key, name text);
      *
      * insert into
      *   instruments (id, name)
      * values
      *   (1, 'harpsichord');
      * ```
      *
      * @exampleResponse Update a record and return it
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": 1,
      *       "name": "piano"
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      *
      * @exampleDescription Updating JSON data
      * Postgres offers some
      * [operators](/docs/guides/database/json#query-the-jsonb-data) for
      * working with JSON data. Currently, it is only possible to update the entire JSON document.
      *
      * @example Updating JSON data
      * ```ts
      * const { data, error } = await supabase
      *   .from('users')
      *   .update({
      *     address: {
      *       street: 'Melrose Place',
      *       postcode: 90210
      *     }
      *   })
      *   .eq('address->postcode', 90210)
      *   .select()
      * ```
      *
      * @exampleSql Updating JSON data
      * ```sql
      * create table
      *   users (
      *     id int8 primary key,
      *     name text,
      *     address jsonb
      *   );
      *
      * insert into
      *   users (id, name, address)
      * values
      *   (1, 'Michael', '{ "postcode": 90210 }');
      * ```
      *
      * @exampleResponse Updating JSON data
      * ```json
      * {
      *   "data": [
      *     {
      *       "id": 1,
      *       "name": "Michael",
      *       "address": {
      *         "street": "Melrose Place",
      *         "postcode": 90210
      *       }
      *     }
      *   ],
      *   "status": 200,
      *   "statusText": "OK"
      * }
      * ```
      */
      update(values, { count } = {}) {
        var _this$fetch3;
        const method = "PATCH";
        const { url, headers } = this.cloneRequestState();
        if (count) headers.append("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          body: values,
          fetch: (_this$fetch3 = this.fetch) !== null && _this$fetch3 !== void 0 ? _this$fetch3 : fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
      /**
      * Perform a DELETE on the table or view.
      *
      * By default, deleted rows are not returned. To return it, chain the call
      * with `.select()` after filters.
      *
      * @param options - Named parameters
      *
      * @param options.count - Count algorithm to use to count deleted rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      */
      delete({ count } = {}) {
        var _this$fetch4;
        const method = "DELETE";
        const { url, headers } = this.cloneRequestState();
        if (count) headers.append("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          fetch: (_this$fetch4 = this.fetch) !== null && _this$fetch4 !== void 0 ? _this$fetch4 : fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
    };
    PostgrestClient = class PostgrestClient2 {
      /**
      * Creates a PostgREST client.
      *
      * @param url - URL of the PostgREST endpoint
      * @param options - Named parameters
      * @param options.headers - Custom headers
      * @param options.schema - Postgres schema to switch to
      * @param options.fetch - Custom fetch
      * @param options.timeout - Optional timeout in milliseconds for all requests. When set, requests will automatically abort after this duration to prevent indefinite hangs.
      * @param options.urlLengthLimit - Maximum URL length in characters before warnings/errors are triggered. Defaults to 8000.
      * @example
      * ```ts
      * import PostgrestClient from '@supabase/postgrest-js'
      *
      * const postgrest = new PostgrestClient('https://xyzcompany.supabase.co/rest/v1', {
      *   headers: { apikey: 'public-anon-key' },
      *   schema: 'public',
      *   timeout: 30000, // 30 second timeout
      * })
      * ```
      */
      constructor(url, { headers = {}, schema, fetch: fetch$1, timeout, urlLengthLimit = 8e3 } = {}) {
        this.url = url;
        this.headers = new Headers(headers);
        this.schemaName = schema;
        this.urlLengthLimit = urlLengthLimit;
        const originalFetch = fetch$1 !== null && fetch$1 !== void 0 ? fetch$1 : globalThis.fetch;
        if (timeout !== void 0 && timeout > 0) this.fetch = (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          const existingSignal = init === null || init === void 0 ? void 0 : init.signal;
          if (existingSignal) {
            if (existingSignal.aborted) {
              clearTimeout(timeoutId);
              return originalFetch(input, init);
            }
            const abortHandler = () => {
              clearTimeout(timeoutId);
              controller.abort();
            };
            existingSignal.addEventListener("abort", abortHandler, { once: true });
            return originalFetch(input, _objectSpread2(_objectSpread2({}, init), {}, { signal: controller.signal })).finally(() => {
              clearTimeout(timeoutId);
              existingSignal.removeEventListener("abort", abortHandler);
            });
          }
          return originalFetch(input, _objectSpread2(_objectSpread2({}, init), {}, { signal: controller.signal })).finally(() => clearTimeout(timeoutId));
        };
        else this.fetch = originalFetch;
      }
      /**
      * Perform a query on a table or a view.
      *
      * @param relation - The table or view name to query
      */
      from(relation) {
        if (!relation || typeof relation !== "string" || relation.trim() === "") throw new Error("Invalid relation name: relation must be a non-empty string.");
        return new PostgrestQueryBuilder(new URL(`${this.url}/${relation}`), {
          headers: new Headers(this.headers),
          schema: this.schemaName,
          fetch: this.fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
      /**
      * Select a schema to query or perform an function (rpc) call.
      *
      * The schema needs to be on the list of exposed schemas inside Supabase.
      *
      * @param schema - The schema to query
      */
      schema(schema) {
        return new PostgrestClient2(this.url, {
          headers: this.headers,
          schema,
          fetch: this.fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
      /**
      * Perform a function call.
      *
      * @param fn - The function name to call
      * @param args - The arguments to pass to the function call
      * @param options - Named parameters
      * @param options.head - When set to `true`, `data` will not be returned.
      * Useful if you only need the count.
      * @param options.get - When set to `true`, the function will be called with
      * read-only access mode.
      * @param options.count - Count algorithm to use to count rows returned by the
      * function. Only applicable for [set-returning
      * functions](https://www.postgresql.org/docs/current/functions-srf.html).
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @example
      * ```ts
      * // For cross-schema functions where type inference fails, use overrideTypes:
      * const { data } = await supabase
      *   .schema('schema_b')
      *   .rpc('function_a', {})
      *   .overrideTypes<{ id: string; user_id: string }[]>()
      * ```
      */
      rpc(fn, args = {}, { head: head2 = false, get: get2 = false, count } = {}) {
        var _this$fetch;
        let method;
        const url = new URL(`${this.url}/rpc/${fn}`);
        let body;
        const _isObject = (v) => v !== null && typeof v === "object" && (!Array.isArray(v) || v.some(_isObject));
        const _hasObjectArg = head2 && Object.values(args).some(_isObject);
        if (_hasObjectArg) {
          method = "POST";
          body = args;
        } else if (head2 || get2) {
          method = head2 ? "HEAD" : "GET";
          Object.entries(args).filter(([_, value]) => value !== void 0).map(([name, value]) => [name, Array.isArray(value) ? `{${value.join(",")}}` : `${value}`]).forEach(([name, value]) => {
            url.searchParams.append(name, value);
          });
        } else {
          method = "POST";
          body = args;
        }
        const headers = new Headers(this.headers);
        if (_hasObjectArg) headers.set("Prefer", count ? `count=${count},return=minimal` : "return=minimal");
        else if (count) headers.set("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schemaName,
          body,
          fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch,
          urlLengthLimit: this.urlLengthLimit
        });
      }
    };
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/websocket-factory.js
var require_websocket_factory = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/websocket-factory.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebSocketFactory = void 0;
    var WebSocketFactory = class {
      /**
       * Static-only utility – prevent instantiation.
       */
      constructor() {
      }
      static detectEnvironment() {
        var _a;
        if (typeof WebSocket !== "undefined") {
          return { type: "native", constructor: WebSocket };
        }
        if (typeof globalThis !== "undefined" && typeof globalThis.WebSocket !== "undefined") {
          return { type: "native", constructor: globalThis.WebSocket };
        }
        if (typeof global !== "undefined" && typeof global.WebSocket !== "undefined") {
          return { type: "native", constructor: global.WebSocket };
        }
        if (typeof globalThis !== "undefined" && typeof globalThis.WebSocketPair !== "undefined" && typeof globalThis.WebSocket === "undefined") {
          return {
            type: "cloudflare",
            error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",
            workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."
          };
        }
        if (typeof globalThis !== "undefined" && globalThis.EdgeRuntime || typeof navigator !== "undefined" && ((_a = navigator.userAgent) === null || _a === void 0 ? void 0 : _a.includes("Vercel-Edge"))) {
          return {
            type: "unsupported",
            error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",
            workaround: "Use serverless functions or a different deployment target for WebSocket functionality."
          };
        }
        const _process = globalThis["process"];
        if (_process) {
          const processVersions = _process["versions"];
          if (processVersions && processVersions["node"]) {
            const versionString = processVersions["node"];
            const nodeVersion = parseInt(versionString.replace(/^v/, "").split(".")[0]);
            if (nodeVersion >= 22) {
              if (typeof globalThis.WebSocket !== "undefined") {
                return { type: "native", constructor: globalThis.WebSocket };
              }
              return {
                type: "unsupported",
                error: `Node.js ${nodeVersion} detected but native WebSocket not found.`,
                workaround: "Provide a WebSocket implementation via the transport option."
              };
            }
            return {
              type: "unsupported",
              error: `Node.js ${nodeVersion} detected without native WebSocket support.`,
              workaround: 'For Node.js < 22, install "ws" package and provide it via the transport option:\nimport ws from "ws"\nnew RealtimeClient(url, { transport: ws })'
            };
          }
        }
        return {
          type: "unsupported",
          error: "Unknown JavaScript runtime without WebSocket support.",
          workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."
        };
      }
      /**
       * Returns the best available WebSocket constructor for the current runtime.
       *
       * @example
       * ```ts
       * const WS = WebSocketFactory.getWebSocketConstructor()
       * const socket = new WS('wss://realtime.supabase.co/socket')
       * ```
       */
      static getWebSocketConstructor() {
        const env = this.detectEnvironment();
        if (env.constructor) {
          return env.constructor;
        }
        let errorMessage = env.error || "WebSocket not supported in this environment.";
        if (env.workaround) {
          errorMessage += `

Suggested solution: ${env.workaround}`;
        }
        throw new Error(errorMessage);
      }
      /**
       * Creates a WebSocket using the detected constructor.
       *
       * @example
       * ```ts
       * const socket = WebSocketFactory.createWebSocket('wss://realtime.supabase.co/socket')
       * ```
       */
      static createWebSocket(url, protocols) {
        const WS = this.getWebSocketConstructor();
        return new WS(url, protocols);
      }
      /**
       * Detects whether the runtime can establish WebSocket connections.
       *
       * @example
       * ```ts
       * if (!WebSocketFactory.isWebSocketSupported()) {
       *   console.warn('Falling back to long polling')
       * }
       * ```
       */
      static isWebSocketSupported() {
        try {
          const env = this.detectEnvironment();
          return env.type === "native" || env.type === "ws";
        } catch (_a) {
          return false;
        }
      }
    };
    exports.WebSocketFactory = WebSocketFactory;
    exports.default = WebSocketFactory;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/version.js
var require_version = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/version.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.version = void 0;
    exports.version = "2.99.2";
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/constants.js
var require_constants = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CONNECTION_STATE = exports.TRANSPORTS = exports.CHANNEL_EVENTS = exports.CHANNEL_STATES = exports.SOCKET_STATES = exports.MAX_PUSH_BUFFER_SIZE = exports.WS_CLOSE_NORMAL = exports.DEFAULT_TIMEOUT = exports.VERSION = exports.DEFAULT_VSN = exports.VSN_2_0_0 = exports.VSN_1_0_0 = exports.DEFAULT_VERSION = void 0;
    var version_1 = require_version();
    exports.DEFAULT_VERSION = `realtime-js/${version_1.version}`;
    exports.VSN_1_0_0 = "1.0.0";
    exports.VSN_2_0_0 = "2.0.0";
    exports.DEFAULT_VSN = exports.VSN_2_0_0;
    exports.VERSION = version_1.version;
    exports.DEFAULT_TIMEOUT = 1e4;
    exports.WS_CLOSE_NORMAL = 1e3;
    exports.MAX_PUSH_BUFFER_SIZE = 100;
    var SOCKET_STATES;
    (function(SOCKET_STATES2) {
      SOCKET_STATES2[SOCKET_STATES2["connecting"] = 0] = "connecting";
      SOCKET_STATES2[SOCKET_STATES2["open"] = 1] = "open";
      SOCKET_STATES2[SOCKET_STATES2["closing"] = 2] = "closing";
      SOCKET_STATES2[SOCKET_STATES2["closed"] = 3] = "closed";
    })(SOCKET_STATES || (exports.SOCKET_STATES = SOCKET_STATES = {}));
    var CHANNEL_STATES;
    (function(CHANNEL_STATES2) {
      CHANNEL_STATES2["closed"] = "closed";
      CHANNEL_STATES2["errored"] = "errored";
      CHANNEL_STATES2["joined"] = "joined";
      CHANNEL_STATES2["joining"] = "joining";
      CHANNEL_STATES2["leaving"] = "leaving";
    })(CHANNEL_STATES || (exports.CHANNEL_STATES = CHANNEL_STATES = {}));
    var CHANNEL_EVENTS;
    (function(CHANNEL_EVENTS2) {
      CHANNEL_EVENTS2["close"] = "phx_close";
      CHANNEL_EVENTS2["error"] = "phx_error";
      CHANNEL_EVENTS2["join"] = "phx_join";
      CHANNEL_EVENTS2["reply"] = "phx_reply";
      CHANNEL_EVENTS2["leave"] = "phx_leave";
      CHANNEL_EVENTS2["access_token"] = "access_token";
    })(CHANNEL_EVENTS || (exports.CHANNEL_EVENTS = CHANNEL_EVENTS = {}));
    var TRANSPORTS;
    (function(TRANSPORTS2) {
      TRANSPORTS2["websocket"] = "websocket";
    })(TRANSPORTS || (exports.TRANSPORTS = TRANSPORTS = {}));
    var CONNECTION_STATE;
    (function(CONNECTION_STATE2) {
      CONNECTION_STATE2["Connecting"] = "connecting";
      CONNECTION_STATE2["Open"] = "open";
      CONNECTION_STATE2["Closing"] = "closing";
      CONNECTION_STATE2["Closed"] = "closed";
    })(CONNECTION_STATE || (exports.CONNECTION_STATE = CONNECTION_STATE = {}));
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/serializer.js
var require_serializer = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/serializer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Serializer = class {
      constructor(allowedMetadataKeys) {
        this.HEADER_LENGTH = 1;
        this.USER_BROADCAST_PUSH_META_LENGTH = 6;
        this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 };
        this.BINARY_ENCODING = 0;
        this.JSON_ENCODING = 1;
        this.BROADCAST_EVENT = "broadcast";
        this.allowedMetadataKeys = [];
        this.allowedMetadataKeys = allowedMetadataKeys !== null && allowedMetadataKeys !== void 0 ? allowedMetadataKeys : [];
      }
      encode(msg, callback) {
        if (msg.event === this.BROADCAST_EVENT && !(msg.payload instanceof ArrayBuffer) && typeof msg.payload.event === "string") {
          return callback(this._binaryEncodeUserBroadcastPush(msg));
        }
        let payload = [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];
        return callback(JSON.stringify(payload));
      }
      _binaryEncodeUserBroadcastPush(message) {
        var _a;
        if (this._isArrayBuffer((_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload)) {
          return this._encodeBinaryUserBroadcastPush(message);
        } else {
          return this._encodeJsonUserBroadcastPush(message);
        }
      }
      _encodeBinaryUserBroadcastPush(message) {
        var _a, _b;
        const userPayload = (_b = (_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : new ArrayBuffer(0);
        return this._encodeUserBroadcastPush(message, this.BINARY_ENCODING, userPayload);
      }
      _encodeJsonUserBroadcastPush(message) {
        var _a, _b;
        const userPayload = (_b = (_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : {};
        const encoder = new TextEncoder();
        const encodedUserPayload = encoder.encode(JSON.stringify(userPayload)).buffer;
        return this._encodeUserBroadcastPush(message, this.JSON_ENCODING, encodedUserPayload);
      }
      _encodeUserBroadcastPush(message, encodingType, encodedPayload) {
        var _a, _b;
        const topic = message.topic;
        const ref = (_a = message.ref) !== null && _a !== void 0 ? _a : "";
        const joinRef = (_b = message.join_ref) !== null && _b !== void 0 ? _b : "";
        const userEvent = message.payload.event;
        const rest = this.allowedMetadataKeys ? this._pick(message.payload, this.allowedMetadataKeys) : {};
        const metadata = Object.keys(rest).length === 0 ? "" : JSON.stringify(rest);
        if (joinRef.length > 255) {
          throw new Error(`joinRef length ${joinRef.length} exceeds maximum of 255`);
        }
        if (ref.length > 255) {
          throw new Error(`ref length ${ref.length} exceeds maximum of 255`);
        }
        if (topic.length > 255) {
          throw new Error(`topic length ${topic.length} exceeds maximum of 255`);
        }
        if (userEvent.length > 255) {
          throw new Error(`userEvent length ${userEvent.length} exceeds maximum of 255`);
        }
        if (metadata.length > 255) {
          throw new Error(`metadata length ${metadata.length} exceeds maximum of 255`);
        }
        const metaLength = this.USER_BROADCAST_PUSH_META_LENGTH + joinRef.length + ref.length + topic.length + userEvent.length + metadata.length;
        const header = new ArrayBuffer(this.HEADER_LENGTH + metaLength);
        let view = new DataView(header);
        let offset = 0;
        view.setUint8(offset++, this.KINDS.userBroadcastPush);
        view.setUint8(offset++, joinRef.length);
        view.setUint8(offset++, ref.length);
        view.setUint8(offset++, topic.length);
        view.setUint8(offset++, userEvent.length);
        view.setUint8(offset++, metadata.length);
        view.setUint8(offset++, encodingType);
        Array.from(joinRef, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(ref, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(topic, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(userEvent, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(metadata, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        var combined = new Uint8Array(header.byteLength + encodedPayload.byteLength);
        combined.set(new Uint8Array(header), 0);
        combined.set(new Uint8Array(encodedPayload), header.byteLength);
        return combined.buffer;
      }
      decode(rawPayload, callback) {
        if (this._isArrayBuffer(rawPayload)) {
          let result = this._binaryDecode(rawPayload);
          return callback(result);
        }
        if (typeof rawPayload === "string") {
          const jsonPayload = JSON.parse(rawPayload);
          const [join_ref, ref, topic, event, payload] = jsonPayload;
          return callback({ join_ref, ref, topic, event, payload });
        }
        return callback({});
      }
      _binaryDecode(buffer) {
        const view = new DataView(buffer);
        const kind = view.getUint8(0);
        const decoder = new TextDecoder();
        switch (kind) {
          case this.KINDS.userBroadcast:
            return this._decodeUserBroadcast(buffer, view, decoder);
        }
      }
      _decodeUserBroadcast(buffer, view, decoder) {
        const topicSize = view.getUint8(1);
        const userEventSize = view.getUint8(2);
        const metadataSize = view.getUint8(3);
        const payloadEncoding = view.getUint8(4);
        let offset = this.HEADER_LENGTH + 4;
        const topic = decoder.decode(buffer.slice(offset, offset + topicSize));
        offset = offset + topicSize;
        const userEvent = decoder.decode(buffer.slice(offset, offset + userEventSize));
        offset = offset + userEventSize;
        const metadata = decoder.decode(buffer.slice(offset, offset + metadataSize));
        offset = offset + metadataSize;
        const payload = buffer.slice(offset, buffer.byteLength);
        const parsedPayload = payloadEncoding === this.JSON_ENCODING ? JSON.parse(decoder.decode(payload)) : payload;
        const data = {
          type: this.BROADCAST_EVENT,
          event: userEvent,
          payload: parsedPayload
        };
        if (metadataSize > 0) {
          data["meta"] = JSON.parse(metadata);
        }
        return { join_ref: null, ref: null, topic, event: this.BROADCAST_EVENT, payload: data };
      }
      _isArrayBuffer(buffer) {
        var _a;
        return buffer instanceof ArrayBuffer || ((_a = buffer === null || buffer === void 0 ? void 0 : buffer.constructor) === null || _a === void 0 ? void 0 : _a.name) === "ArrayBuffer";
      }
      _pick(obj, keys) {
        if (!obj || typeof obj !== "object") {
          return {};
        }
        return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key)));
      }
    };
    exports.default = Serializer;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/timer.js
var require_timer = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/timer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Timer = class {
      constructor(callback, timerCalc) {
        this.callback = callback;
        this.timerCalc = timerCalc;
        this.timer = void 0;
        this.tries = 0;
        this.callback = callback;
        this.timerCalc = timerCalc;
      }
      reset() {
        this.tries = 0;
        clearTimeout(this.timer);
        this.timer = void 0;
      }
      // Cancels any previous scheduleTimeout and schedules callback
      scheduleTimeout() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.tries = this.tries + 1;
          this.callback();
        }, this.timerCalc(this.tries + 1));
      }
    };
    exports.default = Timer;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/transformers.js
var require_transformers = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/transformers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.httpEndpointURL = exports.toTimestampString = exports.toArray = exports.toJson = exports.toNumber = exports.toBoolean = exports.convertCell = exports.convertColumn = exports.convertChangeData = exports.PostgresTypes = void 0;
    var PostgresTypes;
    (function(PostgresTypes2) {
      PostgresTypes2["abstime"] = "abstime";
      PostgresTypes2["bool"] = "bool";
      PostgresTypes2["date"] = "date";
      PostgresTypes2["daterange"] = "daterange";
      PostgresTypes2["float4"] = "float4";
      PostgresTypes2["float8"] = "float8";
      PostgresTypes2["int2"] = "int2";
      PostgresTypes2["int4"] = "int4";
      PostgresTypes2["int4range"] = "int4range";
      PostgresTypes2["int8"] = "int8";
      PostgresTypes2["int8range"] = "int8range";
      PostgresTypes2["json"] = "json";
      PostgresTypes2["jsonb"] = "jsonb";
      PostgresTypes2["money"] = "money";
      PostgresTypes2["numeric"] = "numeric";
      PostgresTypes2["oid"] = "oid";
      PostgresTypes2["reltime"] = "reltime";
      PostgresTypes2["text"] = "text";
      PostgresTypes2["time"] = "time";
      PostgresTypes2["timestamp"] = "timestamp";
      PostgresTypes2["timestamptz"] = "timestamptz";
      PostgresTypes2["timetz"] = "timetz";
      PostgresTypes2["tsrange"] = "tsrange";
      PostgresTypes2["tstzrange"] = "tstzrange";
    })(PostgresTypes || (exports.PostgresTypes = PostgresTypes = {}));
    var convertChangeData = (columns, record, options = {}) => {
      var _a;
      const skipTypes = (_a = options.skipTypes) !== null && _a !== void 0 ? _a : [];
      if (!record) {
        return {};
      }
      return Object.keys(record).reduce((acc, rec_key) => {
        acc[rec_key] = (0, exports.convertColumn)(rec_key, columns, record, skipTypes);
        return acc;
      }, {});
    };
    exports.convertChangeData = convertChangeData;
    var convertColumn = (columnName, columns, record, skipTypes) => {
      const column = columns.find((x) => x.name === columnName);
      const colType = column === null || column === void 0 ? void 0 : column.type;
      const value = record[columnName];
      if (colType && !skipTypes.includes(colType)) {
        return (0, exports.convertCell)(colType, value);
      }
      return noop(value);
    };
    exports.convertColumn = convertColumn;
    var convertCell = (type, value) => {
      if (type.charAt(0) === "_") {
        const dataType = type.slice(1, type.length);
        return (0, exports.toArray)(value, dataType);
      }
      switch (type) {
        case PostgresTypes.bool:
          return (0, exports.toBoolean)(value);
        case PostgresTypes.float4:
        case PostgresTypes.float8:
        case PostgresTypes.int2:
        case PostgresTypes.int4:
        case PostgresTypes.int8:
        case PostgresTypes.numeric:
        case PostgresTypes.oid:
          return (0, exports.toNumber)(value);
        case PostgresTypes.json:
        case PostgresTypes.jsonb:
          return (0, exports.toJson)(value);
        case PostgresTypes.timestamp:
          return (0, exports.toTimestampString)(value);
        // Format to be consistent with PostgREST
        case PostgresTypes.abstime:
        // To allow users to cast it based on Timezone
        case PostgresTypes.date:
        // To allow users to cast it based on Timezone
        case PostgresTypes.daterange:
        case PostgresTypes.int4range:
        case PostgresTypes.int8range:
        case PostgresTypes.money:
        case PostgresTypes.reltime:
        // To allow users to cast it based on Timezone
        case PostgresTypes.text:
        case PostgresTypes.time:
        // To allow users to cast it based on Timezone
        case PostgresTypes.timestamptz:
        // To allow users to cast it based on Timezone
        case PostgresTypes.timetz:
        // To allow users to cast it based on Timezone
        case PostgresTypes.tsrange:
        case PostgresTypes.tstzrange:
          return noop(value);
        default:
          return noop(value);
      }
    };
    exports.convertCell = convertCell;
    var noop = (value) => {
      return value;
    };
    var toBoolean = (value) => {
      switch (value) {
        case "t":
          return true;
        case "f":
          return false;
        default:
          return value;
      }
    };
    exports.toBoolean = toBoolean;
    var toNumber = (value) => {
      if (typeof value === "string") {
        const parsedValue = parseFloat(value);
        if (!Number.isNaN(parsedValue)) {
          return parsedValue;
        }
      }
      return value;
    };
    exports.toNumber = toNumber;
    var toJson = (value) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch (_a) {
          return value;
        }
      }
      return value;
    };
    exports.toJson = toJson;
    var toArray = (value, type) => {
      if (typeof value !== "string") {
        return value;
      }
      const lastIdx = value.length - 1;
      const closeBrace = value[lastIdx];
      const openBrace = value[0];
      if (openBrace === "{" && closeBrace === "}") {
        let arr;
        const valTrim = value.slice(1, lastIdx);
        try {
          arr = JSON.parse("[" + valTrim + "]");
        } catch (_) {
          arr = valTrim ? valTrim.split(",") : [];
        }
        return arr.map((val) => (0, exports.convertCell)(type, val));
      }
      return value;
    };
    exports.toArray = toArray;
    var toTimestampString = (value) => {
      if (typeof value === "string") {
        return value.replace(" ", "T");
      }
      return value;
    };
    exports.toTimestampString = toTimestampString;
    var httpEndpointURL = (socketUrl) => {
      const wsUrl = new URL(socketUrl);
      wsUrl.protocol = wsUrl.protocol.replace(/^ws/i, "http");
      wsUrl.pathname = wsUrl.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, "");
      if (wsUrl.pathname === "" || wsUrl.pathname === "/") {
        wsUrl.pathname = "/api/broadcast";
      } else {
        wsUrl.pathname = wsUrl.pathname + "/api/broadcast";
      }
      return wsUrl.href;
    };
    exports.httpEndpointURL = httpEndpointURL;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/push.js
var require_push = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/push.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var constants_1 = require_constants();
    var Push = class {
      /**
       * Initializes the Push
       *
       * @param channel The Channel
       * @param event The event, for example `"phx_join"`
       * @param payload The payload, for example `{user_id: 123}`
       * @param timeout The push timeout in milliseconds
       */
      constructor(channel, event, payload = {}, timeout = constants_1.DEFAULT_TIMEOUT) {
        this.channel = channel;
        this.event = event;
        this.payload = payload;
        this.timeout = timeout;
        this.sent = false;
        this.timeoutTimer = void 0;
        this.ref = "";
        this.receivedResp = null;
        this.recHooks = [];
        this.refEvent = null;
      }
      resend(timeout) {
        this.timeout = timeout;
        this._cancelRefEvent();
        this.ref = "";
        this.refEvent = null;
        this.receivedResp = null;
        this.sent = false;
        this.send();
      }
      send() {
        if (this._hasReceived("timeout")) {
          return;
        }
        this.startTimeout();
        this.sent = true;
        this.channel.socket.push({
          topic: this.channel.topic,
          event: this.event,
          payload: this.payload,
          ref: this.ref,
          join_ref: this.channel._joinRef()
        });
      }
      updatePayload(payload) {
        this.payload = Object.assign(Object.assign({}, this.payload), payload);
      }
      receive(status, callback) {
        var _a;
        if (this._hasReceived(status)) {
          callback((_a = this.receivedResp) === null || _a === void 0 ? void 0 : _a.response);
        }
        this.recHooks.push({ status, callback });
        return this;
      }
      startTimeout() {
        if (this.timeoutTimer) {
          return;
        }
        this.ref = this.channel.socket._makeRef();
        this.refEvent = this.channel._replyEventName(this.ref);
        const callback = (payload) => {
          this._cancelRefEvent();
          this._cancelTimeout();
          this.receivedResp = payload;
          this._matchReceive(payload);
        };
        this.channel._on(this.refEvent, {}, callback);
        this.timeoutTimer = setTimeout(() => {
          this.trigger("timeout", {});
        }, this.timeout);
      }
      trigger(status, response) {
        if (this.refEvent)
          this.channel._trigger(this.refEvent, { status, response });
      }
      destroy() {
        this._cancelRefEvent();
        this._cancelTimeout();
      }
      _cancelRefEvent() {
        if (!this.refEvent) {
          return;
        }
        this.channel._off(this.refEvent, {});
      }
      _cancelTimeout() {
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = void 0;
      }
      _matchReceive({ status, response }) {
        this.recHooks.filter((h) => h.status === status).forEach((h) => h.callback(response));
      }
      _hasReceived(status) {
        return this.receivedResp && this.receivedResp.status === status;
      }
    };
    exports.default = Push;
  }
});

// node_modules/@supabase/realtime-js/dist/main/RealtimePresence.js
var require_RealtimePresence = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/RealtimePresence.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.REALTIME_PRESENCE_LISTEN_EVENTS = void 0;
    var REALTIME_PRESENCE_LISTEN_EVENTS;
    (function(REALTIME_PRESENCE_LISTEN_EVENTS2) {
      REALTIME_PRESENCE_LISTEN_EVENTS2["SYNC"] = "sync";
      REALTIME_PRESENCE_LISTEN_EVENTS2["JOIN"] = "join";
      REALTIME_PRESENCE_LISTEN_EVENTS2["LEAVE"] = "leave";
    })(REALTIME_PRESENCE_LISTEN_EVENTS || (exports.REALTIME_PRESENCE_LISTEN_EVENTS = REALTIME_PRESENCE_LISTEN_EVENTS = {}));
    var RealtimePresence = class _RealtimePresence {
      /**
       * Creates a Presence helper that keeps the local presence state in sync with the server.
       *
       * @param channel - The realtime channel to bind to.
       * @param opts - Optional custom event names, e.g. `{ events: { state: 'state', diff: 'diff' } }`.
       *
       * @example
       * ```ts
       * const presence = new RealtimePresence(channel)
       *
       * channel.on('presence', ({ event, key }) => {
       *   console.log(`Presence ${event} on ${key}`)
       * })
       * ```
       */
      constructor(channel, opts) {
        this.channel = channel;
        this.state = {};
        this.pendingDiffs = [];
        this.joinRef = null;
        this.enabled = false;
        this.caller = {
          onJoin: () => {
          },
          onLeave: () => {
          },
          onSync: () => {
          }
        };
        const events = (opts === null || opts === void 0 ? void 0 : opts.events) || {
          state: "presence_state",
          diff: "presence_diff"
        };
        this.channel._on(events.state, {}, (newState) => {
          const { onJoin, onLeave, onSync } = this.caller;
          this.joinRef = this.channel._joinRef();
          this.state = _RealtimePresence.syncState(this.state, newState, onJoin, onLeave);
          this.pendingDiffs.forEach((diff) => {
            this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
          });
          this.pendingDiffs = [];
          onSync();
        });
        this.channel._on(events.diff, {}, (diff) => {
          const { onJoin, onLeave, onSync } = this.caller;
          if (this.inPendingSyncState()) {
            this.pendingDiffs.push(diff);
          } else {
            this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
            onSync();
          }
        });
        this.onJoin((key, currentPresences, newPresences) => {
          this.channel._trigger("presence", {
            event: "join",
            key,
            currentPresences,
            newPresences
          });
        });
        this.onLeave((key, currentPresences, leftPresences) => {
          this.channel._trigger("presence", {
            event: "leave",
            key,
            currentPresences,
            leftPresences
          });
        });
        this.onSync(() => {
          this.channel._trigger("presence", { event: "sync" });
        });
      }
      /**
       * Used to sync the list of presences on the server with the
       * client's state.
       *
       * An optional `onJoin` and `onLeave` callback can be provided to
       * react to changes in the client's local presences across
       * disconnects and reconnects with the server.
       *
       * @internal
       */
      static syncState(currentState, newState, onJoin, onLeave) {
        const state = this.cloneDeep(currentState);
        const transformedState = this.transformState(newState);
        const joins = {};
        const leaves = {};
        this.map(state, (key, presences) => {
          if (!transformedState[key]) {
            leaves[key] = presences;
          }
        });
        this.map(transformedState, (key, newPresences) => {
          const currentPresences = state[key];
          if (currentPresences) {
            const newPresenceRefs = newPresences.map((m) => m.presence_ref);
            const curPresenceRefs = currentPresences.map((m) => m.presence_ref);
            const joinedPresences = newPresences.filter((m) => curPresenceRefs.indexOf(m.presence_ref) < 0);
            const leftPresences = currentPresences.filter((m) => newPresenceRefs.indexOf(m.presence_ref) < 0);
            if (joinedPresences.length > 0) {
              joins[key] = joinedPresences;
            }
            if (leftPresences.length > 0) {
              leaves[key] = leftPresences;
            }
          } else {
            joins[key] = newPresences;
          }
        });
        return this.syncDiff(state, { joins, leaves }, onJoin, onLeave);
      }
      /**
       * Used to sync a diff of presence join and leave events from the
       * server, as they happen.
       *
       * Like `syncState`, `syncDiff` accepts optional `onJoin` and
       * `onLeave` callbacks to react to a user joining or leaving from a
       * device.
       *
       * @internal
       */
      static syncDiff(state, diff, onJoin, onLeave) {
        const { joins, leaves } = {
          joins: this.transformState(diff.joins),
          leaves: this.transformState(diff.leaves)
        };
        if (!onJoin) {
          onJoin = () => {
          };
        }
        if (!onLeave) {
          onLeave = () => {
          };
        }
        this.map(joins, (key, newPresences) => {
          var _a;
          const currentPresences = (_a = state[key]) !== null && _a !== void 0 ? _a : [];
          state[key] = this.cloneDeep(newPresences);
          if (currentPresences.length > 0) {
            const joinedPresenceRefs = state[key].map((m) => m.presence_ref);
            const curPresences = currentPresences.filter((m) => joinedPresenceRefs.indexOf(m.presence_ref) < 0);
            state[key].unshift(...curPresences);
          }
          onJoin(key, currentPresences, newPresences);
        });
        this.map(leaves, (key, leftPresences) => {
          let currentPresences = state[key];
          if (!currentPresences)
            return;
          const presenceRefsToRemove = leftPresences.map((m) => m.presence_ref);
          currentPresences = currentPresences.filter((m) => presenceRefsToRemove.indexOf(m.presence_ref) < 0);
          state[key] = currentPresences;
          onLeave(key, currentPresences, leftPresences);
          if (currentPresences.length === 0)
            delete state[key];
        });
        return state;
      }
      /** @internal */
      static map(obj, func) {
        return Object.getOwnPropertyNames(obj).map((key) => func(key, obj[key]));
      }
      /**
       * Remove 'metas' key
       * Change 'phx_ref' to 'presence_ref'
       * Remove 'phx_ref' and 'phx_ref_prev'
       *
       * @example
       * // returns {
       *  abc123: [
       *    { presence_ref: '2', user_id: 1 },
       *    { presence_ref: '3', user_id: 2 }
       *  ]
       * }
       * RealtimePresence.transformState({
       *  abc123: {
       *    metas: [
       *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
       *      { phx_ref: '3', user_id: 2 }
       *    ]
       *  }
       * })
       *
       * @internal
       */
      static transformState(state) {
        state = this.cloneDeep(state);
        return Object.getOwnPropertyNames(state).reduce((newState, key) => {
          const presences = state[key];
          if ("metas" in presences) {
            newState[key] = presences.metas.map((presence) => {
              presence["presence_ref"] = presence["phx_ref"];
              delete presence["phx_ref"];
              delete presence["phx_ref_prev"];
              return presence;
            });
          } else {
            newState[key] = presences;
          }
          return newState;
        }, {});
      }
      /** @internal */
      static cloneDeep(obj) {
        return JSON.parse(JSON.stringify(obj));
      }
      /** @internal */
      onJoin(callback) {
        this.caller.onJoin = callback;
      }
      /** @internal */
      onLeave(callback) {
        this.caller.onLeave = callback;
      }
      /** @internal */
      onSync(callback) {
        this.caller.onSync = callback;
      }
      /** @internal */
      inPendingSyncState() {
        return !this.joinRef || this.joinRef !== this.channel._joinRef();
      }
    };
    exports.default = RealtimePresence;
  }
});

// node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js
var require_RealtimeChannel = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.REALTIME_CHANNEL_STATES = exports.REALTIME_SUBSCRIBE_STATES = exports.REALTIME_LISTEN_TYPES = exports.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var constants_1 = require_constants();
    var push_1 = tslib_1.__importDefault(require_push());
    var timer_1 = tslib_1.__importDefault(require_timer());
    var RealtimePresence_1 = tslib_1.__importDefault(require_RealtimePresence());
    var Transformers = tslib_1.__importStar(require_transformers());
    var transformers_1 = require_transformers();
    var REALTIME_POSTGRES_CHANGES_LISTEN_EVENT;
    (function(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2) {
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["ALL"] = "*";
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["INSERT"] = "INSERT";
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["UPDATE"] = "UPDATE";
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["DELETE"] = "DELETE";
    })(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT || (exports.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = {}));
    var REALTIME_LISTEN_TYPES;
    (function(REALTIME_LISTEN_TYPES2) {
      REALTIME_LISTEN_TYPES2["BROADCAST"] = "broadcast";
      REALTIME_LISTEN_TYPES2["PRESENCE"] = "presence";
      REALTIME_LISTEN_TYPES2["POSTGRES_CHANGES"] = "postgres_changes";
      REALTIME_LISTEN_TYPES2["SYSTEM"] = "system";
    })(REALTIME_LISTEN_TYPES || (exports.REALTIME_LISTEN_TYPES = REALTIME_LISTEN_TYPES = {}));
    var REALTIME_SUBSCRIBE_STATES;
    (function(REALTIME_SUBSCRIBE_STATES2) {
      REALTIME_SUBSCRIBE_STATES2["SUBSCRIBED"] = "SUBSCRIBED";
      REALTIME_SUBSCRIBE_STATES2["TIMED_OUT"] = "TIMED_OUT";
      REALTIME_SUBSCRIBE_STATES2["CLOSED"] = "CLOSED";
      REALTIME_SUBSCRIBE_STATES2["CHANNEL_ERROR"] = "CHANNEL_ERROR";
    })(REALTIME_SUBSCRIBE_STATES || (exports.REALTIME_SUBSCRIBE_STATES = REALTIME_SUBSCRIBE_STATES = {}));
    exports.REALTIME_CHANNEL_STATES = constants_1.CHANNEL_STATES;
    var RealtimeChannel = class _RealtimeChannel {
      /**
       * Creates a channel that can broadcast messages, sync presence, and listen to Postgres changes.
       *
       * The topic determines which realtime stream you are subscribing to. Config options let you
       * enable acknowledgement for broadcasts, presence tracking, or private channels.
       *
       * @example
       * ```ts
       * import RealtimeClient from '@supabase/realtime-js'
       *
       * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
       *   params: { apikey: 'public-anon-key' },
       * })
       * const channel = new RealtimeChannel('realtime:public:messages', { config: {} }, client)
       * ```
       */
      constructor(topic, params = { config: {} }, socket) {
        var _a, _b;
        this.topic = topic;
        this.params = params;
        this.socket = socket;
        this.bindings = {};
        this.state = constants_1.CHANNEL_STATES.closed;
        this.joinedOnce = false;
        this.pushBuffer = [];
        this.subTopic = topic.replace(/^realtime:/i, "");
        this.params.config = Object.assign({
          broadcast: { ack: false, self: false },
          presence: { key: "", enabled: false },
          private: false
        }, params.config);
        this.timeout = this.socket.timeout;
        this.joinPush = new push_1.default(this, constants_1.CHANNEL_EVENTS.join, this.params, this.timeout);
        this.rejoinTimer = new timer_1.default(() => this._rejoinUntilConnected(), this.socket.reconnectAfterMs);
        this.joinPush.receive("ok", () => {
          this.state = constants_1.CHANNEL_STATES.joined;
          this.rejoinTimer.reset();
          this.pushBuffer.forEach((pushEvent) => pushEvent.send());
          this.pushBuffer = [];
        });
        this._onClose(() => {
          this.rejoinTimer.reset();
          this.socket.log("channel", `close ${this.topic} ${this._joinRef()}`);
          this.state = constants_1.CHANNEL_STATES.closed;
          this.socket._remove(this);
        });
        this._onError((reason) => {
          if (this._isLeaving() || this._isClosed()) {
            return;
          }
          this.socket.log("channel", `error ${this.topic}`, reason);
          this.state = constants_1.CHANNEL_STATES.errored;
          this.rejoinTimer.scheduleTimeout();
        });
        this.joinPush.receive("timeout", () => {
          if (!this._isJoining()) {
            return;
          }
          this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout);
          this.state = constants_1.CHANNEL_STATES.errored;
          this.rejoinTimer.scheduleTimeout();
        });
        this.joinPush.receive("error", (reason) => {
          if (this._isLeaving() || this._isClosed()) {
            return;
          }
          this.socket.log("channel", `error ${this.topic}`, reason);
          this.state = constants_1.CHANNEL_STATES.errored;
          this.rejoinTimer.scheduleTimeout();
        });
        this._on(constants_1.CHANNEL_EVENTS.reply, {}, (payload, ref) => {
          this._trigger(this._replyEventName(ref), payload);
        });
        this.presence = new RealtimePresence_1.default(this);
        this.broadcastEndpointURL = (0, transformers_1.httpEndpointURL)(this.socket.endPoint);
        this.private = this.params.config.private || false;
        if (!this.private && ((_b = (_a = this.params.config) === null || _a === void 0 ? void 0 : _a.broadcast) === null || _b === void 0 ? void 0 : _b.replay)) {
          throw `tried to use replay on public channel '${this.topic}'. It must be a private channel.`;
        }
      }
      /** Subscribe registers your client with the server */
      subscribe(callback, timeout = this.timeout) {
        var _a, _b, _c;
        if (!this.socket.isConnected()) {
          this.socket.connect();
        }
        if (this.state == constants_1.CHANNEL_STATES.closed) {
          const { config: { broadcast, presence, private: isPrivate } } = this.params;
          const postgres_changes = (_b = (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.map((r) => r.filter)) !== null && _b !== void 0 ? _b : [];
          const presence_enabled = !!this.bindings[REALTIME_LISTEN_TYPES.PRESENCE] && this.bindings[REALTIME_LISTEN_TYPES.PRESENCE].length > 0 || ((_c = this.params.config.presence) === null || _c === void 0 ? void 0 : _c.enabled) === true;
          const accessTokenPayload = {};
          const config = {
            broadcast,
            presence: Object.assign(Object.assign({}, presence), { enabled: presence_enabled }),
            postgres_changes,
            private: isPrivate
          };
          if (this.socket.accessTokenValue) {
            accessTokenPayload.access_token = this.socket.accessTokenValue;
          }
          this._onError((e) => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, e));
          this._onClose(() => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CLOSED));
          this.updateJoinPayload(Object.assign({ config }, accessTokenPayload));
          this.joinedOnce = true;
          this._rejoin(timeout);
          this.joinPush.receive("ok", async ({ postgres_changes: postgres_changes2 }) => {
            var _a2;
            if (!this.socket._isManualToken()) {
              this.socket.setAuth();
            }
            if (postgres_changes2 === void 0) {
              callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
              return;
            } else {
              const clientPostgresBindings = this.bindings.postgres_changes;
              const bindingsLen = (_a2 = clientPostgresBindings === null || clientPostgresBindings === void 0 ? void 0 : clientPostgresBindings.length) !== null && _a2 !== void 0 ? _a2 : 0;
              const newPostgresBindings = [];
              for (let i = 0; i < bindingsLen; i++) {
                const clientPostgresBinding = clientPostgresBindings[i];
                const { filter: { event, schema, table, filter } } = clientPostgresBinding;
                const serverPostgresFilter = postgres_changes2 && postgres_changes2[i];
                if (serverPostgresFilter && serverPostgresFilter.event === event && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.schema, schema) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.table, table) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.filter, filter)) {
                  newPostgresBindings.push(Object.assign(Object.assign({}, clientPostgresBinding), { id: serverPostgresFilter.id }));
                } else {
                  this.unsubscribe();
                  this.state = constants_1.CHANNEL_STATES.errored;
                  callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error("mismatch between server and client bindings for postgres changes"));
                  return;
                }
              }
              this.bindings.postgres_changes = newPostgresBindings;
              callback && callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
              return;
            }
          }).receive("error", (error) => {
            this.state = constants_1.CHANNEL_STATES.errored;
            callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error(JSON.stringify(Object.values(error).join(", ") || "error")));
            return;
          }).receive("timeout", () => {
            callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.TIMED_OUT);
            return;
          });
        }
        return this;
      }
      /**
       * Returns the current presence state for this channel.
       *
       * The shape is a map keyed by presence key (for example a user id) where each entry contains the
       * tracked metadata for that user.
       */
      presenceState() {
        return this.presence.state;
      }
      /**
       * Sends the supplied payload to the presence tracker so other subscribers can see that this
       * client is online. Use `untrack` to stop broadcasting presence for the same key.
       */
      async track(payload, opts = {}) {
        return await this.send({
          type: "presence",
          event: "track",
          payload
        }, opts.timeout || this.timeout);
      }
      /**
       * Removes the current presence state for this client.
       */
      async untrack(opts = {}) {
        return await this.send({
          type: "presence",
          event: "untrack"
        }, opts);
      }
      on(type, filter, callback) {
        if (this.state === constants_1.CHANNEL_STATES.joined && type === REALTIME_LISTEN_TYPES.PRESENCE) {
          this.socket.log("channel", `resubscribe to ${this.topic} due to change in presence callbacks on joined channel`);
          this.unsubscribe().then(async () => await this.subscribe());
        }
        return this._on(type, filter, callback);
      }
      /**
       * Sends a broadcast message explicitly via REST API.
       *
       * This method always uses the REST API endpoint regardless of WebSocket connection state.
       * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
       *
       * @param event The name of the broadcast event
       * @param payload Payload to be sent (required)
       * @param opts Options including timeout
       * @returns Promise resolving to object with success status, and error details if failed
       */
      async httpSend(event, payload, opts = {}) {
        var _a;
        if (payload === void 0 || payload === null) {
          return Promise.reject("Payload is required for httpSend()");
        }
        const headers = {
          apikey: this.socket.apiKey ? this.socket.apiKey : "",
          "Content-Type": "application/json"
        };
        if (this.socket.accessTokenValue) {
          headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
        }
        const options = {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [
              {
                topic: this.subTopic,
                event,
                payload,
                private: this.private
              }
            ]
          })
        };
        const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
        if (response.status === 202) {
          return { success: true };
        }
        let errorMessage = response.statusText;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (_b) {
        }
        return Promise.reject(new Error(errorMessage));
      }
      /**
       * Sends a message into the channel.
       *
       * @param args Arguments to send to channel
       * @param args.type The type of event to send
       * @param args.event The name of the event being sent
       * @param args.payload Payload to be sent
       * @param opts Options to be used during the send process
       */
      async send(args, opts = {}) {
        var _a, _b;
        if (!this._canPush() && args.type === "broadcast") {
          console.warn("Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.");
          const { event, payload: endpoint_payload } = args;
          const headers = {
            apikey: this.socket.apiKey ? this.socket.apiKey : "",
            "Content-Type": "application/json"
          };
          if (this.socket.accessTokenValue) {
            headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
          }
          const options = {
            method: "POST",
            headers,
            body: JSON.stringify({
              messages: [
                {
                  topic: this.subTopic,
                  event,
                  payload: endpoint_payload,
                  private: this.private
                }
              ]
            })
          };
          try {
            const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
            await ((_b = response.body) === null || _b === void 0 ? void 0 : _b.cancel());
            return response.ok ? "ok" : "error";
          } catch (error) {
            if (error.name === "AbortError") {
              return "timed out";
            } else {
              return "error";
            }
          }
        } else {
          return new Promise((resolve) => {
            var _a2, _b2, _c;
            const push = this._push(args.type, args, opts.timeout || this.timeout);
            if (args.type === "broadcast" && !((_c = (_b2 = (_a2 = this.params) === null || _a2 === void 0 ? void 0 : _a2.config) === null || _b2 === void 0 ? void 0 : _b2.broadcast) === null || _c === void 0 ? void 0 : _c.ack)) {
              resolve("ok");
            }
            push.receive("ok", () => resolve("ok"));
            push.receive("error", () => resolve("error"));
            push.receive("timeout", () => resolve("timed out"));
          });
        }
      }
      /**
       * Updates the payload that will be sent the next time the channel joins (reconnects).
       * Useful for rotating access tokens or updating config without re-creating the channel.
       */
      updateJoinPayload(payload) {
        this.joinPush.updatePayload(payload);
      }
      /**
       * Leaves the channel.
       *
       * Unsubscribes from server events, and instructs channel to terminate on server.
       * Triggers onClose() hooks.
       *
       * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
       * channel.unsubscribe().receive("ok", () => alert("left!") )
       */
      unsubscribe(timeout = this.timeout) {
        this.state = constants_1.CHANNEL_STATES.leaving;
        const onClose = () => {
          this.socket.log("channel", `leave ${this.topic}`);
          this._trigger(constants_1.CHANNEL_EVENTS.close, "leave", this._joinRef());
        };
        this.joinPush.destroy();
        let leavePush = null;
        return new Promise((resolve) => {
          leavePush = new push_1.default(this, constants_1.CHANNEL_EVENTS.leave, {}, timeout);
          leavePush.receive("ok", () => {
            onClose();
            resolve("ok");
          }).receive("timeout", () => {
            onClose();
            resolve("timed out");
          }).receive("error", () => {
            resolve("error");
          });
          leavePush.send();
          if (!this._canPush()) {
            leavePush.trigger("ok", {});
          }
        }).finally(() => {
          leavePush === null || leavePush === void 0 ? void 0 : leavePush.destroy();
        });
      }
      /**
       * Teardown the channel.
       *
       * Destroys and stops related timers.
       */
      teardown() {
        this.pushBuffer.forEach((push) => push.destroy());
        this.pushBuffer = [];
        this.rejoinTimer.reset();
        this.joinPush.destroy();
        this.state = constants_1.CHANNEL_STATES.closed;
        this.bindings = {};
      }
      /** @internal */
      async _fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await this.socket.fetch(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
        clearTimeout(id);
        return response;
      }
      /** @internal */
      _push(event, payload, timeout = this.timeout) {
        if (!this.joinedOnce) {
          throw `tried to push '${event}' to '${this.topic}' before joining. Use channel.subscribe() before pushing events`;
        }
        let pushEvent = new push_1.default(this, event, payload, timeout);
        if (this._canPush()) {
          pushEvent.send();
        } else {
          this._addToPushBuffer(pushEvent);
        }
        return pushEvent;
      }
      /** @internal */
      _addToPushBuffer(pushEvent) {
        pushEvent.startTimeout();
        this.pushBuffer.push(pushEvent);
        if (this.pushBuffer.length > constants_1.MAX_PUSH_BUFFER_SIZE) {
          const removedPush = this.pushBuffer.shift();
          if (removedPush) {
            removedPush.destroy();
            this.socket.log("channel", `discarded push due to buffer overflow: ${removedPush.event}`, removedPush.payload);
          }
        }
      }
      /**
       * Overridable message hook
       *
       * Receives all events for specialized message handling before dispatching to the channel callbacks.
       * Must return the payload, modified or unmodified.
       *
       * @internal
       */
      _onMessage(_event, payload, _ref) {
        return payload;
      }
      /** @internal */
      _isMember(topic) {
        return this.topic === topic;
      }
      /** @internal */
      _joinRef() {
        return this.joinPush.ref;
      }
      /** @internal */
      _trigger(type, payload, ref) {
        var _a, _b;
        const typeLower = type.toLocaleLowerCase();
        const { close, error, leave, join } = constants_1.CHANNEL_EVENTS;
        const events = [close, error, leave, join];
        if (ref && events.indexOf(typeLower) >= 0 && ref !== this._joinRef()) {
          return;
        }
        let handledPayload = this._onMessage(typeLower, payload, ref);
        if (payload && !handledPayload) {
          throw "channel onMessage callbacks must return the payload, modified or unmodified";
        }
        if (["insert", "update", "delete"].includes(typeLower)) {
          (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.filter((bind) => {
            var _a2, _b2, _c;
            return ((_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event) === "*" || ((_c = (_b2 = bind.filter) === null || _b2 === void 0 ? void 0 : _b2.event) === null || _c === void 0 ? void 0 : _c.toLocaleLowerCase()) === typeLower;
          }).map((bind) => bind.callback(handledPayload, ref));
        } else {
          (_b = this.bindings[typeLower]) === null || _b === void 0 ? void 0 : _b.filter((bind) => {
            var _a2, _b2, _c, _d, _e, _f;
            if (["broadcast", "presence", "postgres_changes"].includes(typeLower)) {
              if ("id" in bind) {
                const bindId = bind.id;
                const bindEvent = (_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event;
                return bindId && ((_b2 = payload.ids) === null || _b2 === void 0 ? void 0 : _b2.includes(bindId)) && (bindEvent === "*" || (bindEvent === null || bindEvent === void 0 ? void 0 : bindEvent.toLocaleLowerCase()) === ((_c = payload.data) === null || _c === void 0 ? void 0 : _c.type.toLocaleLowerCase()));
              } else {
                const bindEvent = (_e = (_d = bind === null || bind === void 0 ? void 0 : bind.filter) === null || _d === void 0 ? void 0 : _d.event) === null || _e === void 0 ? void 0 : _e.toLocaleLowerCase();
                return bindEvent === "*" || bindEvent === ((_f = payload === null || payload === void 0 ? void 0 : payload.event) === null || _f === void 0 ? void 0 : _f.toLocaleLowerCase());
              }
            } else {
              return bind.type.toLocaleLowerCase() === typeLower;
            }
          }).map((bind) => {
            if (typeof handledPayload === "object" && "ids" in handledPayload) {
              const postgresChanges = handledPayload.data;
              const { schema, table, commit_timestamp, type: type2, errors } = postgresChanges;
              const enrichedPayload = {
                schema,
                table,
                commit_timestamp,
                eventType: type2,
                new: {},
                old: {},
                errors
              };
              handledPayload = Object.assign(Object.assign({}, enrichedPayload), this._getPayloadRecords(postgresChanges));
            }
            bind.callback(handledPayload, ref);
          });
        }
      }
      /** @internal */
      _isClosed() {
        return this.state === constants_1.CHANNEL_STATES.closed;
      }
      /** @internal */
      _isJoined() {
        return this.state === constants_1.CHANNEL_STATES.joined;
      }
      /** @internal */
      _isJoining() {
        return this.state === constants_1.CHANNEL_STATES.joining;
      }
      /** @internal */
      _isLeaving() {
        return this.state === constants_1.CHANNEL_STATES.leaving;
      }
      /** @internal */
      _replyEventName(ref) {
        return `chan_reply_${ref}`;
      }
      /** @internal */
      _on(type, filter, callback) {
        const typeLower = type.toLocaleLowerCase();
        const binding = {
          type: typeLower,
          filter,
          callback
        };
        if (this.bindings[typeLower]) {
          this.bindings[typeLower].push(binding);
        } else {
          this.bindings[typeLower] = [binding];
        }
        return this;
      }
      /** @internal */
      _off(type, filter) {
        const typeLower = type.toLocaleLowerCase();
        if (this.bindings[typeLower]) {
          this.bindings[typeLower] = this.bindings[typeLower].filter((bind) => {
            var _a;
            return !(((_a = bind.type) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase()) === typeLower && _RealtimeChannel.isEqual(bind.filter, filter));
          });
        }
        return this;
      }
      /** @internal */
      static isEqual(obj1, obj2) {
        if (Object.keys(obj1).length !== Object.keys(obj2).length) {
          return false;
        }
        for (const k in obj1) {
          if (obj1[k] !== obj2[k]) {
            return false;
          }
        }
        return true;
      }
      /**
       * Compares two optional filter values for equality.
       * Treats undefined, null, and empty string as equivalent empty values.
       * @internal
       */
      static isFilterValueEqual(serverValue, clientValue) {
        const normalizedServer = serverValue !== null && serverValue !== void 0 ? serverValue : void 0;
        const normalizedClient = clientValue !== null && clientValue !== void 0 ? clientValue : void 0;
        return normalizedServer === normalizedClient;
      }
      /** @internal */
      _rejoinUntilConnected() {
        this.rejoinTimer.scheduleTimeout();
        if (this.socket.isConnected()) {
          this._rejoin();
        }
      }
      /**
       * Registers a callback that will be executed when the channel closes.
       *
       * @internal
       */
      _onClose(callback) {
        this._on(constants_1.CHANNEL_EVENTS.close, {}, callback);
      }
      /**
       * Registers a callback that will be executed when the channel encounteres an error.
       *
       * @internal
       */
      _onError(callback) {
        this._on(constants_1.CHANNEL_EVENTS.error, {}, (reason) => callback(reason));
      }
      /**
       * Returns `true` if the socket is connected and the channel has been joined.
       *
       * @internal
       */
      _canPush() {
        return this.socket.isConnected() && this._isJoined();
      }
      /** @internal */
      _rejoin(timeout = this.timeout) {
        if (this._isLeaving()) {
          return;
        }
        this.socket._leaveOpenTopic(this.topic);
        this.state = constants_1.CHANNEL_STATES.joining;
        this.joinPush.resend(timeout);
      }
      /** @internal */
      _getPayloadRecords(payload) {
        const records = {
          new: {},
          old: {}
        };
        if (payload.type === "INSERT" || payload.type === "UPDATE") {
          records.new = Transformers.convertChangeData(payload.columns, payload.record);
        }
        if (payload.type === "UPDATE" || payload.type === "DELETE") {
          records.old = Transformers.convertChangeData(payload.columns, payload.old_record);
        }
        return records;
      }
    };
    exports.default = RealtimeChannel;
  }
});

// node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js
var require_RealtimeClient = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var websocket_factory_1 = tslib_1.__importDefault(require_websocket_factory());
    var constants_1 = require_constants();
    var serializer_1 = tslib_1.__importDefault(require_serializer());
    var timer_1 = tslib_1.__importDefault(require_timer());
    var transformers_1 = require_transformers();
    var RealtimeChannel_1 = tslib_1.__importDefault(require_RealtimeChannel());
    var noop = () => {
    };
    var CONNECTION_TIMEOUTS = {
      HEARTBEAT_INTERVAL: 25e3,
      RECONNECT_DELAY: 10,
      HEARTBEAT_TIMEOUT_FALLBACK: 100
    };
    var RECONNECT_INTERVALS = [1e3, 2e3, 5e3, 1e4];
    var DEFAULT_RECONNECT_FALLBACK = 1e4;
    var WORKER_SCRIPT = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;
    var RealtimeClient2 = class {
      /**
       * Initializes the Socket.
       *
       * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
       * @param httpEndpoint The string HTTP endpoint, ie, "https://example.com", "/" (inherited host & protocol)
       * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
       * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
       * @param options.params The optional params to pass when connecting.
       * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
       * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
       * @param options.heartbeatCallback The optional function to handle heartbeat status and latency.
       * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
       * @param options.logLevel Sets the log level for Realtime
       * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
       * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
       * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
       * @param options.worker Use Web Worker to set a side flow. Defaults to false.
       * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
       * @param options.vsn The protocol version to use when connecting. Supported versions are "1.0.0" and "2.0.0". Defaults to "2.0.0".
       * @example
       * ```ts
       * import RealtimeClient from '@supabase/realtime-js'
       *
       * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
       *   params: { apikey: 'public-anon-key' },
       * })
       * client.connect()
       * ```
       */
      constructor(endPoint, options) {
        var _a;
        this.accessTokenValue = null;
        this.apiKey = null;
        this._manuallySetToken = false;
        this.channels = new Array();
        this.endPoint = "";
        this.httpEndpoint = "";
        this.headers = {};
        this.params = {};
        this.timeout = constants_1.DEFAULT_TIMEOUT;
        this.transport = null;
        this.heartbeatIntervalMs = CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
        this.heartbeatTimer = void 0;
        this.pendingHeartbeatRef = null;
        this.heartbeatCallback = noop;
        this.ref = 0;
        this.reconnectTimer = null;
        this.vsn = constants_1.DEFAULT_VSN;
        this.logger = noop;
        this.conn = null;
        this.sendBuffer = [];
        this.serializer = new serializer_1.default();
        this.stateChangeCallbacks = {
          open: [],
          close: [],
          error: [],
          message: []
        };
        this.accessToken = null;
        this._connectionState = "disconnected";
        this._wasManualDisconnect = false;
        this._authPromise = null;
        this._heartbeatSentAt = null;
        this._resolveFetch = (customFetch) => {
          if (customFetch) {
            return (...args) => customFetch(...args);
          }
          return (...args) => fetch(...args);
        };
        if (!((_a = options === null || options === void 0 ? void 0 : options.params) === null || _a === void 0 ? void 0 : _a.apikey)) {
          throw new Error("API key is required to connect to Realtime");
        }
        this.apiKey = options.params.apikey;
        this.endPoint = `${endPoint}/${constants_1.TRANSPORTS.websocket}`;
        this.httpEndpoint = (0, transformers_1.httpEndpointURL)(endPoint);
        this._initializeOptions(options);
        this._setupReconnectionTimer();
        this.fetch = this._resolveFetch(options === null || options === void 0 ? void 0 : options.fetch);
      }
      /**
       * Connects the socket, unless already connected.
       */
      connect() {
        if (this.isConnecting() || this.isDisconnecting() || this.conn !== null && this.isConnected()) {
          return;
        }
        this._setConnectionState("connecting");
        if (this.accessToken && !this._authPromise) {
          this._setAuthSafely("connect");
        }
        if (this.transport) {
          this.conn = new this.transport(this.endpointURL());
        } else {
          try {
            this.conn = websocket_factory_1.default.createWebSocket(this.endpointURL());
          } catch (error) {
            this._setConnectionState("disconnected");
            const errorMessage = error.message;
            if (errorMessage.includes("Node.js")) {
              throw new Error(`${errorMessage}

To use Realtime in Node.js, you need to provide a WebSocket implementation:

Option 1: Use Node.js 22+ which has native WebSocket support
Option 2: Install and provide the "ws" package:

  npm install ws

  import ws from "ws"
  const client = new RealtimeClient(url, {
    ...options,
    transport: ws
  })`);
            }
            throw new Error(`WebSocket not available: ${errorMessage}`);
          }
        }
        this._setupConnectionHandlers();
      }
      /**
       * Returns the URL of the websocket.
       * @returns string The URL of the websocket.
       */
      endpointURL() {
        return this._appendParams(this.endPoint, Object.assign({}, this.params, { vsn: this.vsn }));
      }
      /**
       * Disconnects the socket.
       *
       * @param code A numeric status code to send on disconnect.
       * @param reason A custom reason for the disconnect.
       */
      disconnect(code, reason) {
        if (this.isDisconnecting()) {
          return;
        }
        this._setConnectionState("disconnecting", true);
        if (this.conn) {
          const fallbackTimer = setTimeout(() => {
            this._setConnectionState("disconnected");
          }, 100);
          this.conn.onclose = () => {
            clearTimeout(fallbackTimer);
            this._setConnectionState("disconnected");
          };
          if (typeof this.conn.close === "function") {
            if (code) {
              this.conn.close(code, reason !== null && reason !== void 0 ? reason : "");
            } else {
              this.conn.close();
            }
          }
          this._teardownConnection();
        } else {
          this._setConnectionState("disconnected");
        }
      }
      /**
       * Returns all created channels
       */
      getChannels() {
        return this.channels;
      }
      /**
       * Unsubscribes and removes a single channel
       * @param channel A RealtimeChannel instance
       */
      async removeChannel(channel) {
        const status = await channel.unsubscribe();
        if (this.channels.length === 0) {
          this.disconnect();
        }
        return status;
      }
      /**
       * Unsubscribes and removes all channels
       */
      async removeAllChannels() {
        const values_1 = await Promise.all(this.channels.map((channel) => channel.unsubscribe()));
        this.channels = [];
        this.disconnect();
        return values_1;
      }
      /**
       * Logs the message.
       *
       * For customized logging, `this.logger` can be overridden.
       */
      log(kind, msg, data) {
        this.logger(kind, msg, data);
      }
      /**
       * Returns the current state of the socket.
       */
      connectionState() {
        switch (this.conn && this.conn.readyState) {
          case constants_1.SOCKET_STATES.connecting:
            return constants_1.CONNECTION_STATE.Connecting;
          case constants_1.SOCKET_STATES.open:
            return constants_1.CONNECTION_STATE.Open;
          case constants_1.SOCKET_STATES.closing:
            return constants_1.CONNECTION_STATE.Closing;
          default:
            return constants_1.CONNECTION_STATE.Closed;
        }
      }
      /**
       * Returns `true` is the connection is open.
       */
      isConnected() {
        return this.connectionState() === constants_1.CONNECTION_STATE.Open;
      }
      /**
       * Returns `true` if the connection is currently connecting.
       */
      isConnecting() {
        return this._connectionState === "connecting";
      }
      /**
       * Returns `true` if the connection is currently disconnecting.
       */
      isDisconnecting() {
        return this._connectionState === "disconnecting";
      }
      /**
       * Creates (or reuses) a {@link RealtimeChannel} for the provided topic.
       *
       * Topics are automatically prefixed with `realtime:` to match the Realtime service.
       * If a channel with the same topic already exists it will be returned instead of creating
       * a duplicate connection.
       */
      channel(topic, params = { config: {} }) {
        const realtimeTopic = `realtime:${topic}`;
        const exists = this.getChannels().find((c) => c.topic === realtimeTopic);
        if (!exists) {
          const chan = new RealtimeChannel_1.default(`realtime:${topic}`, params, this);
          this.channels.push(chan);
          return chan;
        } else {
          return exists;
        }
      }
      /**
       * Push out a message if the socket is connected.
       *
       * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
       */
      push(data) {
        const { topic, event, payload, ref } = data;
        const callback = () => {
          this.encode(data, (result) => {
            var _a;
            (_a = this.conn) === null || _a === void 0 ? void 0 : _a.send(result);
          });
        };
        this.log("push", `${topic} ${event} (${ref})`, payload);
        if (this.isConnected()) {
          callback();
        } else {
          this.sendBuffer.push(callback);
        }
      }
      /**
       * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
       *
       * If param is null it will use the `accessToken` callback function or the token set on the client.
       *
       * On callback used, it will set the value of the token internal to the client.
       *
       * When a token is explicitly provided, it will be preserved across channel operations
       * (including removeChannel and resubscribe). The `accessToken` callback will not be
       * invoked until `setAuth()` is called without arguments.
       *
       * @param token A JWT string to override the token set on the client.
       *
       * @example
       * // Use a manual token (preserved across resubscribes, ignores accessToken callback)
       * client.realtime.setAuth('my-custom-jwt')
       *
       * // Switch back to using the accessToken callback
       * client.realtime.setAuth()
       */
      async setAuth(token = null) {
        this._authPromise = this._performAuth(token);
        try {
          await this._authPromise;
        } finally {
          this._authPromise = null;
        }
      }
      /**
       * Returns true if the current access token was explicitly set via setAuth(token),
       * false if it was obtained via the accessToken callback.
       * @internal
       */
      _isManualToken() {
        return this._manuallySetToken;
      }
      /**
       * Sends a heartbeat message if the socket is connected.
       */
      async sendHeartbeat() {
        var _a;
        if (!this.isConnected()) {
          try {
            this.heartbeatCallback("disconnected");
          } catch (e) {
            this.log("error", "error in heartbeat callback", e);
          }
          return;
        }
        if (this.pendingHeartbeatRef) {
          this.pendingHeartbeatRef = null;
          this._heartbeatSentAt = null;
          this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
          try {
            this.heartbeatCallback("timeout");
          } catch (e) {
            this.log("error", "error in heartbeat callback", e);
          }
          this._wasManualDisconnect = false;
          (_a = this.conn) === null || _a === void 0 ? void 0 : _a.close(constants_1.WS_CLOSE_NORMAL, "heartbeat timeout");
          setTimeout(() => {
            var _a2;
            if (!this.isConnected()) {
              (_a2 = this.reconnectTimer) === null || _a2 === void 0 ? void 0 : _a2.scheduleTimeout();
            }
          }, CONNECTION_TIMEOUTS.HEARTBEAT_TIMEOUT_FALLBACK);
          return;
        }
        this._heartbeatSentAt = Date.now();
        this.pendingHeartbeatRef = this._makeRef();
        this.push({
          topic: "phoenix",
          event: "heartbeat",
          payload: {},
          ref: this.pendingHeartbeatRef
        });
        try {
          this.heartbeatCallback("sent");
        } catch (e) {
          this.log("error", "error in heartbeat callback", e);
        }
        this._setAuthSafely("heartbeat");
      }
      /**
       * Sets a callback that receives lifecycle events for internal heartbeat messages.
       * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
       */
      onHeartbeat(callback) {
        this.heartbeatCallback = callback;
      }
      /**
       * Flushes send buffer
       */
      flushSendBuffer() {
        if (this.isConnected() && this.sendBuffer.length > 0) {
          this.sendBuffer.forEach((callback) => callback());
          this.sendBuffer = [];
        }
      }
      /**
       * Return the next message ref, accounting for overflows
       *
       * @internal
       */
      _makeRef() {
        let newRef = this.ref + 1;
        if (newRef === this.ref) {
          this.ref = 0;
        } else {
          this.ref = newRef;
        }
        return this.ref.toString();
      }
      /**
       * Unsubscribe from channels with the specified topic.
       *
       * @internal
       */
      _leaveOpenTopic(topic) {
        let dupChannel = this.channels.find((c) => c.topic === topic && (c._isJoined() || c._isJoining()));
        if (dupChannel) {
          this.log("transport", `leaving duplicate topic "${topic}"`);
          dupChannel.unsubscribe();
        }
      }
      /**
       * Removes a subscription from the socket.
       *
       * @param channel An open subscription.
       *
       * @internal
       */
      _remove(channel) {
        this.channels = this.channels.filter((c) => c.topic !== channel.topic);
      }
      /** @internal */
      _onConnMessage(rawMessage) {
        this.decode(rawMessage.data, (msg) => {
          if (msg.topic === "phoenix" && msg.event === "phx_reply" && msg.ref && msg.ref === this.pendingHeartbeatRef) {
            const latency = this._heartbeatSentAt ? Date.now() - this._heartbeatSentAt : void 0;
            try {
              this.heartbeatCallback(msg.payload.status === "ok" ? "ok" : "error", latency);
            } catch (e) {
              this.log("error", "error in heartbeat callback", e);
            }
            this._heartbeatSentAt = null;
            this.pendingHeartbeatRef = null;
          }
          const { topic, event, payload, ref } = msg;
          const refString = ref ? `(${ref})` : "";
          const status = payload.status || "";
          this.log("receive", `${status} ${topic} ${event} ${refString}`.trim(), payload);
          this.channels.filter((channel) => channel._isMember(topic)).forEach((channel) => channel._trigger(event, payload, ref));
          this._triggerStateCallbacks("message", msg);
        });
      }
      /**
       * Clear specific timer
       * @internal
       */
      _clearTimer(timer) {
        var _a;
        if (timer === "heartbeat" && this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = void 0;
        } else if (timer === "reconnect") {
          (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.reset();
        }
      }
      /**
       * Clear all timers
       * @internal
       */
      _clearAllTimers() {
        this._clearTimer("heartbeat");
        this._clearTimer("reconnect");
      }
      /**
       * Setup connection handlers for WebSocket events
       * @internal
       */
      _setupConnectionHandlers() {
        if (!this.conn)
          return;
        if ("binaryType" in this.conn) {
          ;
          this.conn.binaryType = "arraybuffer";
        }
        this.conn.onopen = () => this._onConnOpen();
        this.conn.onerror = (error) => this._onConnError(error);
        this.conn.onmessage = (event) => this._onConnMessage(event);
        this.conn.onclose = (event) => this._onConnClose(event);
        if (this.conn.readyState === constants_1.SOCKET_STATES.open) {
          this._onConnOpen();
        }
      }
      /**
       * Teardown connection and cleanup resources
       * @internal
       */
      _teardownConnection() {
        if (this.conn) {
          if (this.conn.readyState === constants_1.SOCKET_STATES.open || this.conn.readyState === constants_1.SOCKET_STATES.connecting) {
            try {
              this.conn.close();
            } catch (e) {
              this.log("error", "Error closing connection", e);
            }
          }
          this.conn.onopen = null;
          this.conn.onerror = null;
          this.conn.onmessage = null;
          this.conn.onclose = null;
          this.conn = null;
        }
        this._clearAllTimers();
        this._terminateWorker();
        this.channels.forEach((channel) => channel.teardown());
      }
      /** @internal */
      _onConnOpen() {
        this._setConnectionState("connected");
        this.log("transport", `connected to ${this.endpointURL()}`);
        const authPromise = this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve());
        authPromise.then(() => {
          if (this.accessTokenValue) {
            this.channels.forEach((channel) => {
              channel.updateJoinPayload({ access_token: this.accessTokenValue });
            });
            this.sendBuffer = [];
            this.channels.forEach((channel) => {
              if (channel._isJoining()) {
                channel.joinPush.sent = false;
                channel.joinPush.send();
              }
            });
          }
          this.flushSendBuffer();
        }).catch((e) => {
          this.log("error", "error waiting for auth on connect", e);
          this.flushSendBuffer();
        });
        this._clearTimer("reconnect");
        if (!this.worker) {
          this._startHeartbeat();
        } else {
          if (!this.workerRef) {
            this._startWorkerHeartbeat();
          }
        }
        this._triggerStateCallbacks("open");
      }
      /** @internal */
      _startHeartbeat() {
        this.heartbeatTimer && clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
      }
      /** @internal */
      _startWorkerHeartbeat() {
        if (this.workerUrl) {
          this.log("worker", `starting worker for from ${this.workerUrl}`);
        } else {
          this.log("worker", `starting default worker`);
        }
        const objectUrl = this._workerObjectUrl(this.workerUrl);
        this.workerRef = new Worker(objectUrl);
        this.workerRef.onerror = (error) => {
          this.log("worker", "worker error", error.message);
          this._terminateWorker();
        };
        this.workerRef.onmessage = (event) => {
          if (event.data.event === "keepAlive") {
            this.sendHeartbeat();
          }
        };
        this.workerRef.postMessage({
          event: "start",
          interval: this.heartbeatIntervalMs
        });
      }
      /**
       * Terminate the Web Worker and clear the reference
       * @internal
       */
      _terminateWorker() {
        if (this.workerRef) {
          this.log("worker", "terminating worker");
          this.workerRef.terminate();
          this.workerRef = void 0;
        }
      }
      /** @internal */
      _onConnClose(event) {
        var _a;
        this._setConnectionState("disconnected");
        this.log("transport", "close", event);
        this._triggerChanError();
        this._clearTimer("heartbeat");
        if (!this._wasManualDisconnect) {
          (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.scheduleTimeout();
        }
        this._triggerStateCallbacks("close", event);
      }
      /** @internal */
      _onConnError(error) {
        this._setConnectionState("disconnected");
        this.log("transport", `${error}`);
        this._triggerChanError();
        this._triggerStateCallbacks("error", error);
        try {
          this.heartbeatCallback("error");
        } catch (e) {
          this.log("error", "error in heartbeat callback", e);
        }
      }
      /** @internal */
      _triggerChanError() {
        this.channels.forEach((channel) => channel._trigger(constants_1.CHANNEL_EVENTS.error));
      }
      /** @internal */
      _appendParams(url, params) {
        if (Object.keys(params).length === 0) {
          return url;
        }
        const prefix = url.match(/\?/) ? "&" : "?";
        const query = new URLSearchParams(params);
        return `${url}${prefix}${query}`;
      }
      _workerObjectUrl(url) {
        let result_url;
        if (url) {
          result_url = url;
        } else {
          const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
          result_url = URL.createObjectURL(blob);
        }
        return result_url;
      }
      /**
       * Set connection state with proper state management
       * @internal
       */
      _setConnectionState(state, manual = false) {
        this._connectionState = state;
        if (state === "connecting") {
          this._wasManualDisconnect = false;
        } else if (state === "disconnecting") {
          this._wasManualDisconnect = manual;
        }
      }
      /**
       * Perform the actual auth operation
       * @internal
       */
      async _performAuth(token = null) {
        let tokenToSend;
        let isManualToken = false;
        if (token) {
          tokenToSend = token;
          isManualToken = true;
        } else if (this.accessToken) {
          try {
            tokenToSend = await this.accessToken();
          } catch (e) {
            this.log("error", "Error fetching access token from callback", e);
            tokenToSend = this.accessTokenValue;
          }
        } else {
          tokenToSend = this.accessTokenValue;
        }
        if (isManualToken) {
          this._manuallySetToken = true;
        } else if (this.accessToken) {
          this._manuallySetToken = false;
        }
        if (this.accessTokenValue != tokenToSend) {
          this.accessTokenValue = tokenToSend;
          this.channels.forEach((channel) => {
            const payload = {
              access_token: tokenToSend,
              version: constants_1.DEFAULT_VERSION
            };
            tokenToSend && channel.updateJoinPayload(payload);
            if (channel.joinedOnce && channel._isJoined()) {
              channel._push(constants_1.CHANNEL_EVENTS.access_token, {
                access_token: tokenToSend
              });
            }
          });
        }
      }
      /**
       * Wait for any in-flight auth operations to complete
       * @internal
       */
      async _waitForAuthIfNeeded() {
        if (this._authPromise) {
          await this._authPromise;
        }
      }
      /**
       * Safely call setAuth with standardized error handling
       * @internal
       */
      _setAuthSafely(context = "general") {
        if (!this._isManualToken()) {
          this.setAuth().catch((e) => {
            this.log("error", `Error setting auth in ${context}`, e);
          });
        }
      }
      /**
       * Trigger state change callbacks with proper error handling
       * @internal
       */
      _triggerStateCallbacks(event, data) {
        try {
          this.stateChangeCallbacks[event].forEach((callback) => {
            try {
              callback(data);
            } catch (e) {
              this.log("error", `error in ${event} callback`, e);
            }
          });
        } catch (e) {
          this.log("error", `error triggering ${event} callbacks`, e);
        }
      }
      /**
       * Setup reconnection timer with proper configuration
       * @internal
       */
      _setupReconnectionTimer() {
        this.reconnectTimer = new timer_1.default(async () => {
          setTimeout(async () => {
            await this._waitForAuthIfNeeded();
            if (!this.isConnected()) {
              this.connect();
            }
          }, CONNECTION_TIMEOUTS.RECONNECT_DELAY);
        }, this.reconnectAfterMs);
      }
      /**
       * Initialize client options with defaults
       * @internal
       */
      _initializeOptions(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        this.transport = (_a = options === null || options === void 0 ? void 0 : options.transport) !== null && _a !== void 0 ? _a : null;
        this.timeout = (_b = options === null || options === void 0 ? void 0 : options.timeout) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_TIMEOUT;
        this.heartbeatIntervalMs = (_c = options === null || options === void 0 ? void 0 : options.heartbeatIntervalMs) !== null && _c !== void 0 ? _c : CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
        this.worker = (_d = options === null || options === void 0 ? void 0 : options.worker) !== null && _d !== void 0 ? _d : false;
        this.accessToken = (_e = options === null || options === void 0 ? void 0 : options.accessToken) !== null && _e !== void 0 ? _e : null;
        this.heartbeatCallback = (_f = options === null || options === void 0 ? void 0 : options.heartbeatCallback) !== null && _f !== void 0 ? _f : noop;
        this.vsn = (_g = options === null || options === void 0 ? void 0 : options.vsn) !== null && _g !== void 0 ? _g : constants_1.DEFAULT_VSN;
        if (options === null || options === void 0 ? void 0 : options.params)
          this.params = options.params;
        if (options === null || options === void 0 ? void 0 : options.logger)
          this.logger = options.logger;
        if ((options === null || options === void 0 ? void 0 : options.logLevel) || (options === null || options === void 0 ? void 0 : options.log_level)) {
          this.logLevel = options.logLevel || options.log_level;
          this.params = Object.assign(Object.assign({}, this.params), { log_level: this.logLevel });
        }
        this.reconnectAfterMs = (_h = options === null || options === void 0 ? void 0 : options.reconnectAfterMs) !== null && _h !== void 0 ? _h : ((tries) => {
          return RECONNECT_INTERVALS[tries - 1] || DEFAULT_RECONNECT_FALLBACK;
        });
        switch (this.vsn) {
          case constants_1.VSN_1_0_0:
            this.encode = (_j = options === null || options === void 0 ? void 0 : options.encode) !== null && _j !== void 0 ? _j : ((payload, callback) => {
              return callback(JSON.stringify(payload));
            });
            this.decode = (_k = options === null || options === void 0 ? void 0 : options.decode) !== null && _k !== void 0 ? _k : ((payload, callback) => {
              return callback(JSON.parse(payload));
            });
            break;
          case constants_1.VSN_2_0_0:
            this.encode = (_l = options === null || options === void 0 ? void 0 : options.encode) !== null && _l !== void 0 ? _l : this.serializer.encode.bind(this.serializer);
            this.decode = (_m = options === null || options === void 0 ? void 0 : options.decode) !== null && _m !== void 0 ? _m : this.serializer.decode.bind(this.serializer);
            break;
          default:
            throw new Error(`Unsupported serializer version: ${this.vsn}`);
        }
        if (this.worker) {
          if (typeof window !== "undefined" && !window.Worker) {
            throw new Error("Web Worker is not supported");
          }
          this.workerUrl = options === null || options === void 0 ? void 0 : options.workerUrl;
        }
      }
    };
    exports.default = RealtimeClient2;
  }
});

// node_modules/@supabase/realtime-js/dist/main/index.js
var require_main2 = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebSocketFactory = exports.REALTIME_CHANNEL_STATES = exports.REALTIME_SUBSCRIBE_STATES = exports.REALTIME_PRESENCE_LISTEN_EVENTS = exports.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = exports.REALTIME_LISTEN_TYPES = exports.RealtimeClient = exports.RealtimeChannel = exports.RealtimePresence = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var RealtimeClient_1 = tslib_1.__importDefault(require_RealtimeClient());
    exports.RealtimeClient = RealtimeClient_1.default;
    var RealtimeChannel_1 = tslib_1.__importStar(require_RealtimeChannel());
    exports.RealtimeChannel = RealtimeChannel_1.default;
    Object.defineProperty(exports, "REALTIME_LISTEN_TYPES", { enumerable: true, get: function() {
      return RealtimeChannel_1.REALTIME_LISTEN_TYPES;
    } });
    Object.defineProperty(exports, "REALTIME_POSTGRES_CHANGES_LISTEN_EVENT", { enumerable: true, get: function() {
      return RealtimeChannel_1.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT;
    } });
    Object.defineProperty(exports, "REALTIME_SUBSCRIBE_STATES", { enumerable: true, get: function() {
      return RealtimeChannel_1.REALTIME_SUBSCRIBE_STATES;
    } });
    Object.defineProperty(exports, "REALTIME_CHANNEL_STATES", { enumerable: true, get: function() {
      return RealtimeChannel_1.REALTIME_CHANNEL_STATES;
    } });
    var RealtimePresence_1 = tslib_1.__importStar(require_RealtimePresence());
    exports.RealtimePresence = RealtimePresence_1.default;
    Object.defineProperty(exports, "REALTIME_PRESENCE_LISTEN_EVENTS", { enumerable: true, get: function() {
      return RealtimePresence_1.REALTIME_PRESENCE_LISTEN_EVENTS;
    } });
    var websocket_factory_1 = tslib_1.__importDefault(require_websocket_factory());
    exports.WebSocketFactory = websocket_factory_1.default;
  }
});

// node_modules/iceberg-js/dist/index.mjs
function buildUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== void 0) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}
async function buildAuthHeaders(auth) {
  if (!auth || auth.type === "none") {
    return {};
  }
  if (auth.type === "bearer") {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.type === "header") {
    return { [auth.name]: auth.value };
  }
  if (auth.type === "custom") {
    return await auth.getHeaders();
  }
  return {};
}
function createFetchClient(options) {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  return {
    async request({
      method,
      path,
      query,
      body,
      headers
    }) {
      const url = buildUrl(options.baseUrl, path, query);
      const authHeaders = await buildAuthHeaders(options.auth);
      const res = await fetchFn(url, {
        method,
        headers: {
          ...body ? { "Content-Type": "application/json" } : {},
          ...authHeaders,
          ...headers
        },
        body: body ? JSON.stringify(body) : void 0
      });
      const text = await res.text();
      const isJson = (res.headers.get("content-type") || "").includes("application/json");
      const data = isJson && text ? JSON.parse(text) : text;
      if (!res.ok) {
        const errBody = isJson ? data : void 0;
        const errorDetail = errBody?.error;
        throw new IcebergError(
          errorDetail?.message ?? `Request failed with status ${res.status}`,
          {
            status: res.status,
            icebergType: errorDetail?.type,
            icebergCode: errorDetail?.code,
            details: errBody
          }
        );
      }
      return { status: res.status, headers: res.headers, data };
    }
  };
}
function namespaceToPath(namespace) {
  return namespace.join("");
}
function namespaceToPath2(namespace) {
  return namespace.join("");
}
var IcebergError, NamespaceOperations, TableOperations, IcebergRestCatalog;
var init_dist2 = __esm({
  "node_modules/iceberg-js/dist/index.mjs"() {
    IcebergError = class extends Error {
      constructor(message, opts) {
        super(message);
        this.name = "IcebergError";
        this.status = opts.status;
        this.icebergType = opts.icebergType;
        this.icebergCode = opts.icebergCode;
        this.details = opts.details;
        this.isCommitStateUnknown = opts.icebergType === "CommitStateUnknownException" || [500, 502, 504].includes(opts.status) && opts.icebergType?.includes("CommitState") === true;
      }
      /**
       * Returns true if the error is a 404 Not Found error.
       */
      isNotFound() {
        return this.status === 404;
      }
      /**
       * Returns true if the error is a 409 Conflict error.
       */
      isConflict() {
        return this.status === 409;
      }
      /**
       * Returns true if the error is a 419 Authentication Timeout error.
       */
      isAuthenticationTimeout() {
        return this.status === 419;
      }
    };
    NamespaceOperations = class {
      constructor(client, prefix = "") {
        this.client = client;
        this.prefix = prefix;
      }
      async listNamespaces(parent) {
        const query = parent ? { parent: namespaceToPath(parent.namespace) } : void 0;
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces`,
          query
        });
        return response.data.namespaces.map((ns) => ({ namespace: ns }));
      }
      async createNamespace(id, metadata) {
        const request = {
          namespace: id.namespace,
          properties: metadata?.properties
        };
        const response = await this.client.request({
          method: "POST",
          path: `${this.prefix}/namespaces`,
          body: request
        });
        return response.data;
      }
      async dropNamespace(id) {
        await this.client.request({
          method: "DELETE",
          path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
        });
      }
      async loadNamespaceMetadata(id) {
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
        });
        return {
          properties: response.data.properties
        };
      }
      async namespaceExists(id) {
        try {
          await this.client.request({
            method: "HEAD",
            path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
          });
          return true;
        } catch (error) {
          if (error instanceof IcebergError && error.status === 404) {
            return false;
          }
          throw error;
        }
      }
      async createNamespaceIfNotExists(id, metadata) {
        try {
          return await this.createNamespace(id, metadata);
        } catch (error) {
          if (error instanceof IcebergError && error.status === 409) {
            return;
          }
          throw error;
        }
      }
    };
    TableOperations = class {
      constructor(client, prefix = "", accessDelegation) {
        this.client = client;
        this.prefix = prefix;
        this.accessDelegation = accessDelegation;
      }
      async listTables(namespace) {
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`
        });
        return response.data.identifiers;
      }
      async createTable(namespace, request) {
        const headers = {};
        if (this.accessDelegation) {
          headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
        }
        const response = await this.client.request({
          method: "POST",
          path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`,
          body: request,
          headers
        });
        return response.data.metadata;
      }
      async updateTable(id, request) {
        const response = await this.client.request({
          method: "POST",
          path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
          body: request
        });
        return {
          "metadata-location": response.data["metadata-location"],
          metadata: response.data.metadata
        };
      }
      async dropTable(id, options) {
        await this.client.request({
          method: "DELETE",
          path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
          query: { purgeRequested: String(options?.purge ?? false) }
        });
      }
      async loadTable(id) {
        const headers = {};
        if (this.accessDelegation) {
          headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
        }
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
          headers
        });
        return response.data.metadata;
      }
      async tableExists(id) {
        const headers = {};
        if (this.accessDelegation) {
          headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
        }
        try {
          await this.client.request({
            method: "HEAD",
            path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
            headers
          });
          return true;
        } catch (error) {
          if (error instanceof IcebergError && error.status === 404) {
            return false;
          }
          throw error;
        }
      }
      async createTableIfNotExists(namespace, request) {
        try {
          return await this.createTable(namespace, request);
        } catch (error) {
          if (error instanceof IcebergError && error.status === 409) {
            return await this.loadTable({ namespace: namespace.namespace, name: request.name });
          }
          throw error;
        }
      }
    };
    IcebergRestCatalog = class {
      /**
       * Creates a new Iceberg REST Catalog client.
       *
       * @param options - Configuration options for the catalog client
       */
      constructor(options) {
        let prefix = "v1";
        if (options.catalogName) {
          prefix += `/${options.catalogName}`;
        }
        const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
        this.client = createFetchClient({
          baseUrl,
          auth: options.auth,
          fetchImpl: options.fetch
        });
        this.accessDelegation = options.accessDelegation?.join(",");
        this.namespaceOps = new NamespaceOperations(this.client, prefix);
        this.tableOps = new TableOperations(this.client, prefix, this.accessDelegation);
      }
      /**
       * Lists all namespaces in the catalog.
       *
       * @param parent - Optional parent namespace to list children under
       * @returns Array of namespace identifiers
       *
       * @example
       * ```typescript
       * // List all top-level namespaces
       * const namespaces = await catalog.listNamespaces();
       *
       * // List namespaces under a parent
       * const children = await catalog.listNamespaces({ namespace: ['analytics'] });
       * ```
       */
      async listNamespaces(parent) {
        return this.namespaceOps.listNamespaces(parent);
      }
      /**
       * Creates a new namespace in the catalog.
       *
       * @param id - Namespace identifier to create
       * @param metadata - Optional metadata properties for the namespace
       * @returns Response containing the created namespace and its properties
       *
       * @example
       * ```typescript
       * const response = await catalog.createNamespace(
       *   { namespace: ['analytics'] },
       *   { properties: { owner: 'data-team' } }
       * );
       * console.log(response.namespace); // ['analytics']
       * console.log(response.properties); // { owner: 'data-team', ... }
       * ```
       */
      async createNamespace(id, metadata) {
        return this.namespaceOps.createNamespace(id, metadata);
      }
      /**
       * Drops a namespace from the catalog.
       *
       * The namespace must be empty (contain no tables) before it can be dropped.
       *
       * @param id - Namespace identifier to drop
       *
       * @example
       * ```typescript
       * await catalog.dropNamespace({ namespace: ['analytics'] });
       * ```
       */
      async dropNamespace(id) {
        await this.namespaceOps.dropNamespace(id);
      }
      /**
       * Loads metadata for a namespace.
       *
       * @param id - Namespace identifier to load
       * @returns Namespace metadata including properties
       *
       * @example
       * ```typescript
       * const metadata = await catalog.loadNamespaceMetadata({ namespace: ['analytics'] });
       * console.log(metadata.properties);
       * ```
       */
      async loadNamespaceMetadata(id) {
        return this.namespaceOps.loadNamespaceMetadata(id);
      }
      /**
       * Lists all tables in a namespace.
       *
       * @param namespace - Namespace identifier to list tables from
       * @returns Array of table identifiers
       *
       * @example
       * ```typescript
       * const tables = await catalog.listTables({ namespace: ['analytics'] });
       * console.log(tables); // [{ namespace: ['analytics'], name: 'events' }, ...]
       * ```
       */
      async listTables(namespace) {
        return this.tableOps.listTables(namespace);
      }
      /**
       * Creates a new table in the catalog.
       *
       * @param namespace - Namespace to create the table in
       * @param request - Table creation request including name, schema, partition spec, etc.
       * @returns Table metadata for the created table
       *
       * @example
       * ```typescript
       * const metadata = await catalog.createTable(
       *   { namespace: ['analytics'] },
       *   {
       *     name: 'events',
       *     schema: {
       *       type: 'struct',
       *       fields: [
       *         { id: 1, name: 'id', type: 'long', required: true },
       *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
       *       ],
       *       'schema-id': 0
       *     },
       *     'partition-spec': {
       *       'spec-id': 0,
       *       fields: [
       *         { source_id: 2, field_id: 1000, name: 'ts_day', transform: 'day' }
       *       ]
       *     }
       *   }
       * );
       * ```
       */
      async createTable(namespace, request) {
        return this.tableOps.createTable(namespace, request);
      }
      /**
       * Updates an existing table's metadata.
       *
       * Can update the schema, partition spec, or properties of a table.
       *
       * @param id - Table identifier to update
       * @param request - Update request with fields to modify
       * @returns Response containing the metadata location and updated table metadata
       *
       * @example
       * ```typescript
       * const response = await catalog.updateTable(
       *   { namespace: ['analytics'], name: 'events' },
       *   {
       *     properties: { 'read.split.target-size': '134217728' }
       *   }
       * );
       * console.log(response['metadata-location']); // s3://...
       * console.log(response.metadata); // TableMetadata object
       * ```
       */
      async updateTable(id, request) {
        return this.tableOps.updateTable(id, request);
      }
      /**
       * Drops a table from the catalog.
       *
       * @param id - Table identifier to drop
       *
       * @example
       * ```typescript
       * await catalog.dropTable({ namespace: ['analytics'], name: 'events' });
       * ```
       */
      async dropTable(id, options) {
        await this.tableOps.dropTable(id, options);
      }
      /**
       * Loads metadata for a table.
       *
       * @param id - Table identifier to load
       * @returns Table metadata including schema, partition spec, location, etc.
       *
       * @example
       * ```typescript
       * const metadata = await catalog.loadTable({ namespace: ['analytics'], name: 'events' });
       * console.log(metadata.schema);
       * console.log(metadata.location);
       * ```
       */
      async loadTable(id) {
        return this.tableOps.loadTable(id);
      }
      /**
       * Checks if a namespace exists in the catalog.
       *
       * @param id - Namespace identifier to check
       * @returns True if the namespace exists, false otherwise
       *
       * @example
       * ```typescript
       * const exists = await catalog.namespaceExists({ namespace: ['analytics'] });
       * console.log(exists); // true or false
       * ```
       */
      async namespaceExists(id) {
        return this.namespaceOps.namespaceExists(id);
      }
      /**
       * Checks if a table exists in the catalog.
       *
       * @param id - Table identifier to check
       * @returns True if the table exists, false otherwise
       *
       * @example
       * ```typescript
       * const exists = await catalog.tableExists({ namespace: ['analytics'], name: 'events' });
       * console.log(exists); // true or false
       * ```
       */
      async tableExists(id) {
        return this.tableOps.tableExists(id);
      }
      /**
       * Creates a namespace if it does not exist.
       *
       * If the namespace already exists, returns void. If created, returns the response.
       *
       * @param id - Namespace identifier to create
       * @param metadata - Optional metadata properties for the namespace
       * @returns Response containing the created namespace and its properties, or void if it already exists
       *
       * @example
       * ```typescript
       * const response = await catalog.createNamespaceIfNotExists(
       *   { namespace: ['analytics'] },
       *   { properties: { owner: 'data-team' } }
       * );
       * if (response) {
       *   console.log('Created:', response.namespace);
       * } else {
       *   console.log('Already exists');
       * }
       * ```
       */
      async createNamespaceIfNotExists(id, metadata) {
        return this.namespaceOps.createNamespaceIfNotExists(id, metadata);
      }
      /**
       * Creates a table if it does not exist.
       *
       * If the table already exists, returns its metadata instead.
       *
       * @param namespace - Namespace to create the table in
       * @param request - Table creation request including name, schema, partition spec, etc.
       * @returns Table metadata for the created or existing table
       *
       * @example
       * ```typescript
       * const metadata = await catalog.createTableIfNotExists(
       *   { namespace: ['analytics'] },
       *   {
       *     name: 'events',
       *     schema: {
       *       type: 'struct',
       *       fields: [
       *         { id: 1, name: 'id', type: 'long', required: true },
       *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
       *       ],
       *       'schema-id': 0
       *     }
       *   }
       * );
       * ```
       */
      async createTableIfNotExists(namespace, request) {
        return this.tableOps.createTableIfNotExists(namespace, request);
      }
    };
  }
});

// node_modules/@supabase/storage-js/dist/index.mjs
function isStorageError(error) {
  return typeof error === "object" && error !== null && "__isStorageError" in error;
}
function _typeof2(o) {
  "@babel/helpers - typeof";
  return _typeof2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof2(o);
}
function toPrimitive2(t, r) {
  if ("object" != _typeof2(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof2(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function toPropertyKey2(t) {
  var i = toPrimitive2(t, "string");
  return "symbol" == _typeof2(i) ? i : i + "";
}
function _defineProperty2(e, r, t) {
  return (r = toPropertyKey2(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function ownKeys3(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread22(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys3(Object(t), true).forEach(function(r$1) {
      _defineProperty2(e, r$1, t[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys3(Object(t)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
    });
  }
  return e;
}
async function _handleRequest(fetcher, method, url, options, parameters, body, namespace) {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body)).then((result) => {
      if (!result.ok) throw result;
      if (options === null || options === void 0 ? void 0 : options.noResolveJson) return result;
      if (namespace === "vectors") {
        const contentType = result.headers.get("content-type");
        if (result.headers.get("content-length") === "0" || result.status === 204) return {};
        if (!contentType || !contentType.includes("application/json")) return {};
      }
      return result.json();
    }).then((data) => resolve(data)).catch((error) => handleError(error, reject, options, namespace));
  });
}
function createFetchApi(namespace = "storage") {
  return {
    get: async (fetcher, url, options, parameters) => {
      return _handleRequest(fetcher, "GET", url, options, parameters, void 0, namespace);
    },
    post: async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "POST", url, options, parameters, body, namespace);
    },
    put: async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "PUT", url, options, parameters, body, namespace);
    },
    head: async (fetcher, url, options, parameters) => {
      return _handleRequest(fetcher, "HEAD", url, _objectSpread22(_objectSpread22({}, options), {}, { noResolveJson: true }), parameters, void 0, namespace);
    },
    remove: async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "DELETE", url, options, parameters, body, namespace);
    }
  };
}
var StorageError, StorageApiError, StorageUnknownError, resolveFetch, isPlainObject, recursiveToCamel, isValidBucketName, _getErrorMessage, handleError, _getRequestParams, defaultApi, get, post, put, head, remove, vectorsApi, BaseApiClient, StreamDownloadBuilder, _Symbol$toStringTag, BlobDownloadBuilder, DEFAULT_SEARCH_OPTIONS, DEFAULT_FILE_OPTIONS, StorageFileApi, version, DEFAULT_HEADERS, StorageBucketApi, StorageAnalyticsClient, VectorIndexApi, VectorDataApi, VectorBucketApi, StorageVectorsClient, VectorBucketScope, VectorIndexScope, StorageClient;
var init_dist3 = __esm({
  "node_modules/@supabase/storage-js/dist/index.mjs"() {
    init_dist2();
    StorageError = class extends Error {
      constructor(message, namespace = "storage", status, statusCode) {
        super(message);
        this.__isStorageError = true;
        this.namespace = namespace;
        this.name = namespace === "vectors" ? "StorageVectorsError" : "StorageError";
        this.status = status;
        this.statusCode = statusCode;
      }
    };
    StorageApiError = class extends StorageError {
      constructor(message, status, statusCode, namespace = "storage") {
        super(message, namespace, status, statusCode);
        this.name = namespace === "vectors" ? "StorageVectorsApiError" : "StorageApiError";
        this.status = status;
        this.statusCode = statusCode;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          status: this.status,
          statusCode: this.statusCode
        };
      }
    };
    StorageUnknownError = class extends StorageError {
      constructor(message, originalError, namespace = "storage") {
        super(message, namespace);
        this.name = namespace === "vectors" ? "StorageVectorsUnknownError" : "StorageUnknownError";
        this.originalError = originalError;
      }
    };
    resolveFetch = (customFetch) => {
      if (customFetch) return (...args) => customFetch(...args);
      return (...args) => fetch(...args);
    };
    isPlainObject = (value) => {
      if (typeof value !== "object" || value === null) return false;
      const prototype = Object.getPrototypeOf(value);
      return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
    };
    recursiveToCamel = (item) => {
      if (Array.isArray(item)) return item.map((el) => recursiveToCamel(el));
      else if (typeof item === "function" || item !== Object(item)) return item;
      const result = {};
      Object.entries(item).forEach(([key, value]) => {
        const newKey = key.replace(/([-_][a-z])/gi, (c) => c.toUpperCase().replace(/[-_]/g, ""));
        result[newKey] = recursiveToCamel(value);
      });
      return result;
    };
    isValidBucketName = (bucketName) => {
      if (!bucketName || typeof bucketName !== "string") return false;
      if (bucketName.length === 0 || bucketName.length > 100) return false;
      if (bucketName.trim() !== bucketName) return false;
      if (bucketName.includes("/") || bucketName.includes("\\")) return false;
      return /^[\w!.\*'() &$@=;:+,?-]+$/.test(bucketName);
    };
    _getErrorMessage = (err) => {
      var _err$error;
      return err.msg || err.message || err.error_description || (typeof err.error === "string" ? err.error : (_err$error = err.error) === null || _err$error === void 0 ? void 0 : _err$error.message) || JSON.stringify(err);
    };
    handleError = async (error, reject, options, namespace) => {
      if (error && typeof error === "object" && "status" in error && "ok" in error && typeof error.status === "number") {
        const responseError = error;
        const status = responseError.status || 500;
        if (typeof responseError.json === "function") responseError.json().then((err) => {
          const statusCode = (err === null || err === void 0 ? void 0 : err.statusCode) || (err === null || err === void 0 ? void 0 : err.code) || status + "";
          reject(new StorageApiError(_getErrorMessage(err), status, statusCode, namespace));
        }).catch(() => {
          if (namespace === "vectors") {
            const statusCode = status + "";
            reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
          } else {
            const statusCode = status + "";
            reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
          }
        });
        else {
          const statusCode = status + "";
          reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
        }
      } else reject(new StorageUnknownError(_getErrorMessage(error), error, namespace));
    };
    _getRequestParams = (method, options, parameters, body) => {
      const params = {
        method,
        headers: (options === null || options === void 0 ? void 0 : options.headers) || {}
      };
      if (method === "GET" || method === "HEAD" || !body) return _objectSpread22(_objectSpread22({}, params), parameters);
      if (isPlainObject(body)) {
        params.headers = _objectSpread22({ "Content-Type": "application/json" }, options === null || options === void 0 ? void 0 : options.headers);
        params.body = JSON.stringify(body);
      } else params.body = body;
      if (options === null || options === void 0 ? void 0 : options.duplex) params.duplex = options.duplex;
      return _objectSpread22(_objectSpread22({}, params), parameters);
    };
    defaultApi = createFetchApi("storage");
    ({ get, post, put, head, remove } = defaultApi);
    vectorsApi = createFetchApi("vectors");
    BaseApiClient = class {
      /**
      * Creates a new BaseApiClient instance
      * @param url - Base URL for API requests
      * @param headers - Default headers for API requests
      * @param fetch - Optional custom fetch implementation
      * @param namespace - Error namespace ('storage' or 'vectors')
      */
      constructor(url, headers = {}, fetch$1, namespace = "storage") {
        this.shouldThrowOnError = false;
        this.url = url;
        this.headers = headers;
        this.fetch = resolveFetch(fetch$1);
        this.namespace = namespace;
      }
      /**
      * Enable throwing errors instead of returning them.
      * When enabled, errors are thrown instead of returned in { data, error } format.
      *
      * @returns this - For method chaining
      */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /**
      * Set an HTTP header for the request.
      * Creates a shallow copy of headers to avoid mutating shared state.
      *
      * @param name - Header name
      * @param value - Header value
      * @returns this - For method chaining
      */
      setHeader(name, value) {
        this.headers = _objectSpread22(_objectSpread22({}, this.headers), {}, { [name]: value });
        return this;
      }
      /**
      * Handles API operation with standardized error handling
      * Eliminates repetitive try-catch blocks across all API methods
      *
      * This wrapper:
      * 1. Executes the operation
      * 2. Returns { data, error: null } on success
      * 3. Returns { data: null, error } on failure (if shouldThrowOnError is false)
      * 4. Throws error on failure (if shouldThrowOnError is true)
      *
      * @typeParam T - The expected data type from the operation
      * @param operation - Async function that performs the API call
      * @returns Promise with { data, error } tuple
      *
      * @example
      * ```typescript
      * async listBuckets() {
      *   return this.handleOperation(async () => {
      *     return await get(this.fetch, `${this.url}/bucket`, {
      *       headers: this.headers,
      *     })
      *   })
      * }
      * ```
      */
      async handleOperation(operation) {
        var _this = this;
        try {
          return {
            data: await operation(),
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    StreamDownloadBuilder = class {
      constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
      }
      then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
      }
      async execute() {
        var _this = this;
        try {
          return {
            data: (await _this.downloadFn()).body,
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    _Symbol$toStringTag = Symbol.toStringTag;
    BlobDownloadBuilder = class {
      constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
        this[_Symbol$toStringTag] = "BlobDownloadBuilder";
        this.promise = null;
      }
      asStream() {
        return new StreamDownloadBuilder(this.downloadFn, this.shouldThrowOnError);
      }
      then(onfulfilled, onrejected) {
        return this.getPromise().then(onfulfilled, onrejected);
      }
      catch(onrejected) {
        return this.getPromise().catch(onrejected);
      }
      finally(onfinally) {
        return this.getPromise().finally(onfinally);
      }
      getPromise() {
        if (!this.promise) this.promise = this.execute();
        return this.promise;
      }
      async execute() {
        var _this = this;
        try {
          return {
            data: await (await _this.downloadFn()).blob(),
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    DEFAULT_SEARCH_OPTIONS = {
      limit: 100,
      offset: 0,
      sortBy: {
        column: "name",
        order: "asc"
      }
    };
    DEFAULT_FILE_OPTIONS = {
      cacheControl: "3600",
      contentType: "text/plain;charset=UTF-8",
      upsert: false
    };
    StorageFileApi = class extends BaseApiClient {
      constructor(url, headers = {}, bucketId, fetch$1) {
        super(url, headers, fetch$1, "storage");
        this.bucketId = bucketId;
      }
      /**
      * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
      *
      * @param method HTTP method.
      * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
      * @param fileBody The body of the file to be stored in the bucket.
      */
      async uploadOrUpdate(method, path, fileBody, fileOptions) {
        var _this = this;
        return _this.handleOperation(async () => {
          let body;
          const options = _objectSpread22(_objectSpread22({}, DEFAULT_FILE_OPTIONS), fileOptions);
          let headers = _objectSpread22(_objectSpread22({}, _this.headers), method === "POST" && { "x-upsert": String(options.upsert) });
          const metadata = options.metadata;
          if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
            body = new FormData();
            body.append("cacheControl", options.cacheControl);
            if (metadata) body.append("metadata", _this.encodeMetadata(metadata));
            body.append("", fileBody);
          } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
            body = fileBody;
            if (!body.has("cacheControl")) body.append("cacheControl", options.cacheControl);
            if (metadata && !body.has("metadata")) body.append("metadata", _this.encodeMetadata(metadata));
          } else {
            body = fileBody;
            headers["cache-control"] = `max-age=${options.cacheControl}`;
            headers["content-type"] = options.contentType;
            if (metadata) headers["x-metadata"] = _this.toBase64(_this.encodeMetadata(metadata));
            if ((typeof ReadableStream !== "undefined" && body instanceof ReadableStream || body && typeof body === "object" && "pipe" in body && typeof body.pipe === "function") && !options.duplex) options.duplex = "half";
          }
          if (fileOptions === null || fileOptions === void 0 ? void 0 : fileOptions.headers) headers = _objectSpread22(_objectSpread22({}, headers), fileOptions.headers);
          const cleanPath = _this._removeEmptyFolders(path);
          const _path = _this._getFinalPath(cleanPath);
          const data = await (method == "PUT" ? put : post)(_this.fetch, `${_this.url}/object/${_path}`, body, _objectSpread22({ headers }, (options === null || options === void 0 ? void 0 : options.duplex) ? { duplex: options.duplex } : {}));
          return {
            path: cleanPath,
            id: data.Id,
            fullPath: data.Key
          };
        });
      }
      /**
      * Uploads a file to an existing bucket.
      *
      * @category File Buckets
      * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
      * @param fileBody The body of the file to be stored in the bucket.
      * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
      * @returns Promise with response containing file path, id, and fullPath or error
      *
      * @example Upload file
      * ```js
      * const avatarFile = event.target.files[0]
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .upload('public/avatar1.png', avatarFile, {
      *     cacheControl: '3600',
      *     upsert: false
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "public/avatar1.png",
      *     "fullPath": "avatars/public/avatar1.png"
      *   },
      *   "error": null
      * }
      * ```
      *
      * @example Upload file using `ArrayBuffer` from base64 file data
      * ```js
      * import { decode } from 'base64-arraybuffer'
      *
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .upload('public/avatar1.png', decode('base64FileData'), {
      *     contentType: 'image/png'
      *   })
      * ```
      */
      async upload(path, fileBody, fileOptions) {
        return this.uploadOrUpdate("POST", path, fileBody, fileOptions);
      }
      /**
      * Upload a file with a token generated from `createSignedUploadUrl`.
      *
      * @category File Buckets
      * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
      * @param token The token generated from `createSignedUploadUrl`
      * @param fileBody The body of the file to be stored in the bucket.
      * @param fileOptions HTTP headers (cacheControl, contentType, etc.).
      * **Note:** The `upsert` option has no effect here. To enable upsert behavior,
      * pass `{ upsert: true }` when calling `createSignedUploadUrl()` instead.
      * @returns Promise with response containing file path and fullPath or error
      *
      * @example Upload to a signed URL
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .uploadToSignedUrl('folder/cat.jpg', 'token-from-createSignedUploadUrl', file)
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "folder/cat.jpg",
      *     "fullPath": "avatars/folder/cat.jpg"
      *   },
      *   "error": null
      * }
      * ```
      */
      async uploadToSignedUrl(path, token, fileBody, fileOptions) {
        var _this3 = this;
        const cleanPath = _this3._removeEmptyFolders(path);
        const _path = _this3._getFinalPath(cleanPath);
        const url = new URL(_this3.url + `/object/upload/sign/${_path}`);
        url.searchParams.set("token", token);
        return _this3.handleOperation(async () => {
          let body;
          const options = _objectSpread22({ upsert: DEFAULT_FILE_OPTIONS.upsert }, fileOptions);
          const headers = _objectSpread22(_objectSpread22({}, _this3.headers), { "x-upsert": String(options.upsert) });
          if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
            body = new FormData();
            body.append("cacheControl", options.cacheControl);
            body.append("", fileBody);
          } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
            body = fileBody;
            body.append("cacheControl", options.cacheControl);
          } else {
            body = fileBody;
            headers["cache-control"] = `max-age=${options.cacheControl}`;
            headers["content-type"] = options.contentType;
          }
          return {
            path: cleanPath,
            fullPath: (await put(_this3.fetch, url.toString(), body, { headers })).Key
          };
        });
      }
      /**
      * Creates a signed upload URL.
      * Signed upload URLs can be used to upload files to the bucket without further authentication.
      * They are valid for 2 hours.
      *
      * @category File Buckets
      * @param path The file path, including the current file name. For example `folder/image.png`.
      * @param options.upsert If set to true, allows the file to be overwritten if it already exists.
      * @returns Promise with response containing signed upload URL, token, and path or error
      *
      * @example Create Signed Upload URL
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUploadUrl('folder/cat.jpg')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "signedUrl": "https://example.supabase.co/storage/v1/object/upload/sign/avatars/folder/cat.jpg?token=<TOKEN>",
      *     "path": "folder/cat.jpg",
      *     "token": "<TOKEN>"
      *   },
      *   "error": null
      * }
      * ```
      */
      async createSignedUploadUrl(path, options) {
        var _this4 = this;
        return _this4.handleOperation(async () => {
          let _path = _this4._getFinalPath(path);
          const headers = _objectSpread22({}, _this4.headers);
          if (options === null || options === void 0 ? void 0 : options.upsert) headers["x-upsert"] = "true";
          const data = await post(_this4.fetch, `${_this4.url}/object/upload/sign/${_path}`, {}, { headers });
          const url = new URL(_this4.url + data.url);
          const token = url.searchParams.get("token");
          if (!token) throw new StorageError("No token returned by API");
          return {
            signedUrl: url.toString(),
            path,
            token
          };
        });
      }
      /**
      * Replaces an existing file at the specified path with a new one.
      *
      * @category File Buckets
      * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to update.
      * @param fileBody The body of the file to be stored in the bucket.
      * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
      * @returns Promise with response containing file path, id, and fullPath or error
      *
      * @example Update file
      * ```js
      * const avatarFile = event.target.files[0]
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .update('public/avatar1.png', avatarFile, {
      *     cacheControl: '3600',
      *     upsert: true
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "public/avatar1.png",
      *     "fullPath": "avatars/public/avatar1.png"
      *   },
      *   "error": null
      * }
      * ```
      *
      * @example Update file using `ArrayBuffer` from base64 file data
      * ```js
      * import {decode} from 'base64-arraybuffer'
      *
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .update('public/avatar1.png', decode('base64FileData'), {
      *     contentType: 'image/png'
      *   })
      * ```
      */
      async update(path, fileBody, fileOptions) {
        return this.uploadOrUpdate("PUT", path, fileBody, fileOptions);
      }
      /**
      * Moves an existing file to a new path in the same bucket.
      *
      * @category File Buckets
      * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
      * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
      * @param options The destination options.
      * @returns Promise with response containing success message or error
      *
      * @example Move file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .move('public/avatar1.png', 'private/avatar2.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully moved"
      *   },
      *   "error": null
      * }
      * ```
      */
      async move(fromPath, toPath, options) {
        var _this6 = this;
        return _this6.handleOperation(async () => {
          return await post(_this6.fetch, `${_this6.url}/object/move`, {
            bucketId: _this6.bucketId,
            sourceKey: fromPath,
            destinationKey: toPath,
            destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
          }, { headers: _this6.headers });
        });
      }
      /**
      * Copies an existing file to a new path in the same bucket.
      *
      * @category File Buckets
      * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
      * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
      * @param options The destination options.
      * @returns Promise with response containing copied file path or error
      *
      * @example Copy file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .copy('public/avatar1.png', 'private/avatar2.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "avatars/private/avatar2.png"
      *   },
      *   "error": null
      * }
      * ```
      */
      async copy(fromPath, toPath, options) {
        var _this7 = this;
        return _this7.handleOperation(async () => {
          return { path: (await post(_this7.fetch, `${_this7.url}/object/copy`, {
            bucketId: _this7.bucketId,
            sourceKey: fromPath,
            destinationKey: toPath,
            destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
          }, { headers: _this7.headers })).Key };
        });
      }
      /**
      * Creates a signed URL. Use a signed URL to share a file for a fixed amount of time.
      *
      * @category File Buckets
      * @param path The file path, including the current file name. For example `folder/image.png`.
      * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
      * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
      * @param options.transform Transform the asset before serving it to the client.
      * @returns Promise with response containing signed URL or error
      *
      * @example Create Signed URL
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrl('folder/avatar1.png', 60)
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
      *   },
      *   "error": null
      * }
      * ```
      *
      * @example Create a signed URL for an asset with transformations
      * ```js
      * const { data } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrl('folder/avatar1.png', 60, {
      *     transform: {
      *       width: 100,
      *       height: 100,
      *     }
      *   })
      * ```
      *
      * @example Create a signed URL which triggers the download of the asset
      * ```js
      * const { data } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrl('folder/avatar1.png', 60, {
      *     download: true,
      *   })
      * ```
      */
      async createSignedUrl(path, expiresIn, options) {
        var _this8 = this;
        return _this8.handleOperation(async () => {
          let _path = _this8._getFinalPath(path);
          const hasTransform = typeof (options === null || options === void 0 ? void 0 : options.transform) === "object" && options.transform !== null && Object.keys(options.transform).length > 0;
          let data = await post(_this8.fetch, `${_this8.url}/object/sign/${_path}`, _objectSpread22({ expiresIn }, hasTransform ? { transform: options.transform } : {}), { headers: _this8.headers });
          const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
          const returnedPath = hasTransform && data.signedURL.includes("/object/sign/") ? data.signedURL.replace("/object/sign/", "/render/image/sign/") : data.signedURL;
          return { signedUrl: encodeURI(`${_this8.url}${returnedPath}${downloadQueryParam}`) };
        });
      }
      /**
      * Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time.
      *
      * @category File Buckets
      * @param paths The file paths to be downloaded, including the current file names. For example `['folder/image.png', 'folder2/image2.png']`.
      * @param expiresIn The number of seconds until the signed URLs expire. For example, `60` for URLs which are valid for one minute.
      * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
      * @returns Promise with response containing array of objects with signedUrl, path, and error or error
      *
      * @example Create Signed URLs
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrls(['folder/avatar1.png', 'folder/avatar2.png'], 60)
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": [
      *     {
      *       "error": null,
      *       "path": "folder/avatar1.png",
      *       "signedURL": "/object/sign/avatars/folder/avatar1.png?token=<TOKEN>",
      *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
      *     },
      *     {
      *       "error": null,
      *       "path": "folder/avatar2.png",
      *       "signedURL": "/object/sign/avatars/folder/avatar2.png?token=<TOKEN>",
      *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar2.png?token=<TOKEN>"
      *     }
      *   ],
      *   "error": null
      * }
      * ```
      */
      async createSignedUrls(paths, expiresIn, options) {
        var _this9 = this;
        return _this9.handleOperation(async () => {
          const data = await post(_this9.fetch, `${_this9.url}/object/sign/${_this9.bucketId}`, {
            expiresIn,
            paths
          }, { headers: _this9.headers });
          const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
          return data.map((datum) => _objectSpread22(_objectSpread22({}, datum), {}, { signedUrl: datum.signedURL ? encodeURI(`${_this9.url}${datum.signedURL}${downloadQueryParam}`) : null }));
        });
      }
      /**
      * Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead.
      *
      * @category File Buckets
      * @param path The full path and file name of the file to be downloaded. For example `folder/image.png`.
      * @param options.transform Transform the asset before serving it to the client.
      * @param parameters Additional fetch parameters like signal for cancellation. Supports standard fetch options including cache control.
      * @returns BlobDownloadBuilder instance for downloading the file
      *
      * @example Download file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .download('folder/avatar1.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": <BLOB>,
      *   "error": null
      * }
      * ```
      *
      * @example Download file with transformations
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .download('folder/avatar1.png', {
      *     transform: {
      *       width: 100,
      *       height: 100,
      *       quality: 80
      *     }
      *   })
      * ```
      *
      * @example Download with cache control (useful in Edge Functions)
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .download('folder/avatar1.png', {}, { cache: 'no-store' })
      * ```
      *
      * @example Download with abort signal
      * ```js
      * const controller = new AbortController()
      * setTimeout(() => controller.abort(), 5000)
      *
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .download('folder/avatar1.png', {}, { signal: controller.signal })
      * ```
      */
      download(path, options, parameters) {
        const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image/authenticated" : "object";
        const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
        const queryString = transformationQuery ? `?${transformationQuery}` : "";
        const _path = this._getFinalPath(path);
        const downloadFn = () => get(this.fetch, `${this.url}/${renderPath}/${_path}${queryString}`, {
          headers: this.headers,
          noResolveJson: true
        }, parameters);
        return new BlobDownloadBuilder(downloadFn, this.shouldThrowOnError);
      }
      /**
      * Retrieves the details of an existing file.
      *
      * Returns detailed file metadata including size, content type, and timestamps.
      * Note: The API returns `last_modified` field, not `updated_at`.
      *
      * @category File Buckets
      * @param path The file path, including the file name. For example `folder/image.png`.
      * @returns Promise with response containing file metadata or error
      *
      * @example Get file info
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .info('folder/avatar1.png')
      *
      * if (data) {
      *   console.log('Last modified:', data.lastModified)
      *   console.log('Size:', data.size)
      * }
      * ```
      */
      async info(path) {
        var _this10 = this;
        const _path = _this10._getFinalPath(path);
        return _this10.handleOperation(async () => {
          return recursiveToCamel(await get(_this10.fetch, `${_this10.url}/object/info/${_path}`, { headers: _this10.headers }));
        });
      }
      /**
      * Checks the existence of a file.
      *
      * @category File Buckets
      * @param path The file path, including the file name. For example `folder/image.png`.
      * @returns Promise with response containing boolean indicating file existence or error
      *
      * @example Check file existence
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .exists('folder/avatar1.png')
      * ```
      */
      async exists(path) {
        var _this11 = this;
        const _path = _this11._getFinalPath(path);
        try {
          await head(_this11.fetch, `${_this11.url}/object/${_path}`, { headers: _this11.headers });
          return {
            data: true,
            error: null
          };
        } catch (error) {
          if (_this11.shouldThrowOnError) throw error;
          if (isStorageError(error)) {
            var _error$originalError;
            const status = error instanceof StorageApiError ? error.status : error instanceof StorageUnknownError ? (_error$originalError = error.originalError) === null || _error$originalError === void 0 ? void 0 : _error$originalError.status : void 0;
            if (status !== void 0 && [400, 404].includes(status)) return {
              data: false,
              error
            };
          }
          throw error;
        }
      }
      /**
      * A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset.
      * This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset.
      *
      * @category File Buckets
      * @param path The path and name of the file to generate the public URL for. For example `folder/image.png`.
      * @param options.download Triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
      * @param options.transform Transform the asset before serving it to the client.
      * @returns Object with public URL
      *
      * @example Returns the URL for an asset in a public bucket
      * ```js
      * const { data } = supabase
      *   .storage
      *   .from('public-bucket')
      *   .getPublicUrl('folder/avatar1.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "publicUrl": "https://example.supabase.co/storage/v1/object/public/public-bucket/folder/avatar1.png"
      *   }
      * }
      * ```
      *
      * @example Returns the URL for an asset in a public bucket with transformations
      * ```js
      * const { data } = supabase
      *   .storage
      *   .from('public-bucket')
      *   .getPublicUrl('folder/avatar1.png', {
      *     transform: {
      *       width: 100,
      *       height: 100,
      *     }
      *   })
      * ```
      *
      * @example Returns the URL which triggers the download of an asset in a public bucket
      * ```js
      * const { data } = supabase
      *   .storage
      *   .from('public-bucket')
      *   .getPublicUrl('folder/avatar1.png', {
      *     download: true,
      *   })
      * ```
      */
      getPublicUrl(path, options) {
        const _path = this._getFinalPath(path);
        const _queryString = [];
        const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `download=${options.download === true ? "" : options.download}` : "";
        if (downloadQueryParam !== "") _queryString.push(downloadQueryParam);
        const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image" : "object";
        const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
        if (transformationQuery !== "") _queryString.push(transformationQuery);
        let queryString = _queryString.join("&");
        if (queryString !== "") queryString = `?${queryString}`;
        return { data: { publicUrl: encodeURI(`${this.url}/${renderPath}/public/${_path}${queryString}`) } };
      }
      /**
      * Deletes files within the same bucket
      *
      * Returns an array of FileObject entries for the deleted files. Note that deprecated
      * fields like `bucket_id` may or may not be present in the response - do not rely on them.
      *
      * @category File Buckets
      * @param paths An array of files to delete, including the path and file name. For example [`'folder/image.png'`].
      * @returns Promise with response containing array of deleted file objects or error
      *
      * @example Delete file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .remove(['folder/avatar1.png'])
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": [],
      *   "error": null
      * }
      * ```
      */
      async remove(paths) {
        var _this12 = this;
        return _this12.handleOperation(async () => {
          return await remove(_this12.fetch, `${_this12.url}/object/${_this12.bucketId}`, { prefixes: paths }, { headers: _this12.headers });
        });
      }
      /**
      * Get file metadata
      * @param id the file id to retrieve metadata
      */
      /**
      * Update file metadata
      * @param id the file id to update metadata
      * @param meta the new file metadata
      */
      /**
      * Lists all the files and folders within a path of the bucket.
      *
      * **Important:** For folder entries, fields like `id`, `updated_at`, `created_at`,
      * `last_accessed_at`, and `metadata` will be `null`. Only files have these fields populated.
      * Additionally, deprecated fields like `bucket_id`, `owner`, and `buckets` are NOT returned
      * by this method.
      *
      * @category File Buckets
      * @param path The folder path.
      * @param options Search options including limit (defaults to 100), offset, sortBy, and search
      * @param parameters Optional fetch parameters including signal for cancellation
      * @returns Promise with response containing array of files/folders or error
      *
      * @example List files in a bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .list('folder', {
      *     limit: 100,
      *     offset: 0,
      *     sortBy: { column: 'name', order: 'asc' },
      *   })
      *
      * // Handle files vs folders
      * data?.forEach(item => {
      *   if (item.id !== null) {
      *     // It's a file
      *     console.log('File:', item.name, 'Size:', item.metadata?.size)
      *   } else {
      *     // It's a folder
      *     console.log('Folder:', item.name)
      *   }
      * })
      * ```
      *
      * Response (file entry):
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "avatar1.png",
      *       "id": "e668cf7f-821b-4a2f-9dce-7dfa5dd1cfd2",
      *       "updated_at": "2024-05-22T23:06:05.580Z",
      *       "created_at": "2024-05-22T23:04:34.443Z",
      *       "last_accessed_at": "2024-05-22T23:04:34.443Z",
      *       "metadata": {
      *         "eTag": "\"c5e8c553235d9af30ef4f6e280790b92\"",
      *         "size": 32175,
      *         "mimetype": "image/png",
      *         "cacheControl": "max-age=3600",
      *         "lastModified": "2024-05-22T23:06:05.574Z",
      *         "contentLength": 32175,
      *         "httpStatusCode": 200
      *       }
      *     }
      *   ],
      *   "error": null
      * }
      * ```
      *
      * @example Search files in a bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .list('folder', {
      *     limit: 100,
      *     offset: 0,
      *     sortBy: { column: 'name', order: 'asc' },
      *     search: 'jon'
      *   })
      * ```
      */
      async list(path, options, parameters) {
        var _this13 = this;
        return _this13.handleOperation(async () => {
          const body = _objectSpread22(_objectSpread22(_objectSpread22({}, DEFAULT_SEARCH_OPTIONS), options), {}, { prefix: path || "" });
          return await post(_this13.fetch, `${_this13.url}/object/list/${_this13.bucketId}`, body, { headers: _this13.headers }, parameters);
        });
      }
      /**
      * Lists all the files and folders within a bucket using the V2 API with pagination support.
      *
      * **Important:** Folder entries in the `folders` array only contain `name` and optionally `key` —
      * they have no `id`, timestamps, or `metadata` fields. Full file metadata is only available
      * on entries in the `objects` array.
      *
      * @experimental this method signature might change in the future
      *
      * @category File Buckets
      * @param options Search options including prefix, cursor for pagination, limit, with_delimiter
      * @param parameters Optional fetch parameters including signal for cancellation
      * @returns Promise with response containing folders/objects arrays with pagination info or error
      *
      * @example List files with pagination
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .listV2({
      *     prefix: 'folder/',
      *     limit: 100,
      *   })
      *
      * // Handle pagination
      * if (data?.hasNext) {
      *   const nextPage = await supabase
      *     .storage
      *     .from('avatars')
      *     .listV2({
      *       prefix: 'folder/',
      *       cursor: data.nextCursor,
      *     })
      * }
      *
      * // Handle files vs folders
      * data?.objects.forEach(file => {
      *   if (file.id !== null) {
      *     console.log('File:', file.name, 'Size:', file.metadata?.size)
      *   }
      * })
      * data?.folders.forEach(folder => {
      *   console.log('Folder:', folder.name)
      * })
      * ```
      */
      async listV2(options, parameters) {
        var _this14 = this;
        return _this14.handleOperation(async () => {
          const body = _objectSpread22({}, options);
          return await post(_this14.fetch, `${_this14.url}/object/list-v2/${_this14.bucketId}`, body, { headers: _this14.headers }, parameters);
        });
      }
      encodeMetadata(metadata) {
        return JSON.stringify(metadata);
      }
      toBase64(data) {
        if (typeof Buffer !== "undefined") return Buffer.from(data).toString("base64");
        return btoa(data);
      }
      _getFinalPath(path) {
        return `${this.bucketId}/${path.replace(/^\/+/, "")}`;
      }
      _removeEmptyFolders(path) {
        return path.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
      }
      transformOptsToQueryString(transform) {
        const params = [];
        if (transform.width) params.push(`width=${transform.width}`);
        if (transform.height) params.push(`height=${transform.height}`);
        if (transform.resize) params.push(`resize=${transform.resize}`);
        if (transform.format) params.push(`format=${transform.format}`);
        if (transform.quality) params.push(`quality=${transform.quality}`);
        return params.join("&");
      }
    };
    version = "2.99.2";
    DEFAULT_HEADERS = { "X-Client-Info": `storage-js/${version}` };
    StorageBucketApi = class extends BaseApiClient {
      constructor(url, headers = {}, fetch$1, opts) {
        const baseUrl = new URL(url);
        if (opts === null || opts === void 0 ? void 0 : opts.useNewHostname) {
          if (/supabase\.(co|in|red)$/.test(baseUrl.hostname) && !baseUrl.hostname.includes("storage.supabase.")) baseUrl.hostname = baseUrl.hostname.replace("supabase.", "storage.supabase.");
        }
        const finalUrl = baseUrl.href.replace(/\/$/, "");
        const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), headers);
        super(finalUrl, finalHeaders, fetch$1, "storage");
      }
      /**
      * Retrieves the details of all Storage buckets within an existing project.
      *
      * @category File Buckets
      * @param options Query parameters for listing buckets
      * @param options.limit Maximum number of buckets to return
      * @param options.offset Number of buckets to skip
      * @param options.sortColumn Column to sort by ('id', 'name', 'created_at', 'updated_at')
      * @param options.sortOrder Sort order ('asc' or 'desc')
      * @param options.search Search term to filter bucket names
      * @returns Promise with response containing array of buckets or error
      *
      * @example List buckets
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .listBuckets()
      * ```
      *
      * @example List buckets with options
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .listBuckets({
      *     limit: 10,
      *     offset: 0,
      *     sortColumn: 'created_at',
      *     sortOrder: 'desc',
      *     search: 'prod'
      *   })
      * ```
      */
      async listBuckets(options) {
        var _this = this;
        return _this.handleOperation(async () => {
          const queryString = _this.listBucketOptionsToQueryString(options);
          return await get(_this.fetch, `${_this.url}/bucket${queryString}`, { headers: _this.headers });
        });
      }
      /**
      * Retrieves the details of an existing Storage bucket.
      *
      * @category File Buckets
      * @param id The unique identifier of the bucket you would like to retrieve.
      * @returns Promise with response containing bucket details or error
      *
      * @example Get bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .getBucket('avatars')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "id": "avatars",
      *     "name": "avatars",
      *     "owner": "",
      *     "public": false,
      *     "file_size_limit": 1024,
      *     "allowed_mime_types": [
      *       "image/png"
      *     ],
      *     "created_at": "2024-05-22T22:26:05.100Z",
      *     "updated_at": "2024-05-22T22:26:05.100Z"
      *   },
      *   "error": null
      * }
      * ```
      */
      async getBucket(id) {
        var _this2 = this;
        return _this2.handleOperation(async () => {
          return await get(_this2.fetch, `${_this2.url}/bucket/${id}`, { headers: _this2.headers });
        });
      }
      /**
      * Creates a new Storage bucket
      *
      * @category File Buckets
      * @param id A unique identifier for the bucket you are creating.
      * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
      * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
      * The global file size limit takes precedence over this value.
      * The default value is null, which doesn't set a per bucket file size limit.
      * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
      * The default value is null, which allows files with all mime types to be uploaded.
      * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
      * @param options.type (private-beta) specifies the bucket type. see `BucketType` for more details.
      *   - default bucket type is `STANDARD`
      * @returns Promise with response containing newly created bucket name or error
      *
      * @example Create bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .createBucket('avatars', {
      *     public: false,
      *     allowedMimeTypes: ['image/png'],
      *     fileSizeLimit: 1024
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "name": "avatars"
      *   },
      *   "error": null
      * }
      * ```
      */
      async createBucket(id, options = { public: false }) {
        var _this3 = this;
        return _this3.handleOperation(async () => {
          return await post(_this3.fetch, `${_this3.url}/bucket`, {
            id,
            name: id,
            type: options.type,
            public: options.public,
            file_size_limit: options.fileSizeLimit,
            allowed_mime_types: options.allowedMimeTypes
          }, { headers: _this3.headers });
        });
      }
      /**
      * Updates a Storage bucket
      *
      * @category File Buckets
      * @param id A unique identifier for the bucket you are updating.
      * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
      * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
      * The global file size limit takes precedence over this value.
      * The default value is null, which doesn't set a per bucket file size limit.
      * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
      * The default value is null, which allows files with all mime types to be uploaded.
      * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
      * @returns Promise with response containing success message or error
      *
      * @example Update bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .updateBucket('avatars', {
      *     public: false,
      *     allowedMimeTypes: ['image/png'],
      *     fileSizeLimit: 1024
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully updated"
      *   },
      *   "error": null
      * }
      * ```
      */
      async updateBucket(id, options) {
        var _this4 = this;
        return _this4.handleOperation(async () => {
          return await put(_this4.fetch, `${_this4.url}/bucket/${id}`, {
            id,
            name: id,
            public: options.public,
            file_size_limit: options.fileSizeLimit,
            allowed_mime_types: options.allowedMimeTypes
          }, { headers: _this4.headers });
        });
      }
      /**
      * Removes all objects inside a single bucket.
      *
      * @category File Buckets
      * @param id The unique identifier of the bucket you would like to empty.
      * @returns Promise with success message or error
      *
      * @example Empty bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .emptyBucket('avatars')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully emptied"
      *   },
      *   "error": null
      * }
      * ```
      */
      async emptyBucket(id) {
        var _this5 = this;
        return _this5.handleOperation(async () => {
          return await post(_this5.fetch, `${_this5.url}/bucket/${id}/empty`, {}, { headers: _this5.headers });
        });
      }
      /**
      * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
      * You must first `empty()` the bucket.
      *
      * @category File Buckets
      * @param id The unique identifier of the bucket you would like to delete.
      * @returns Promise with success message or error
      *
      * @example Delete bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .deleteBucket('avatars')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully deleted"
      *   },
      *   "error": null
      * }
      * ```
      */
      async deleteBucket(id) {
        var _this6 = this;
        return _this6.handleOperation(async () => {
          return await remove(_this6.fetch, `${_this6.url}/bucket/${id}`, {}, { headers: _this6.headers });
        });
      }
      listBucketOptionsToQueryString(options) {
        const params = {};
        if (options) {
          if ("limit" in options) params.limit = String(options.limit);
          if ("offset" in options) params.offset = String(options.offset);
          if (options.search) params.search = options.search;
          if (options.sortColumn) params.sortColumn = options.sortColumn;
          if (options.sortOrder) params.sortOrder = options.sortOrder;
        }
        return Object.keys(params).length > 0 ? "?" + new URLSearchParams(params).toString() : "";
      }
    };
    StorageAnalyticsClient = class extends BaseApiClient {
      /**
      * @alpha
      *
      * Creates a new StorageAnalyticsClient instance
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param url - The base URL for the storage API
      * @param headers - HTTP headers to include in requests
      * @param fetch - Optional custom fetch implementation
      *
      * @example
      * ```typescript
      * const client = new StorageAnalyticsClient(url, headers)
      * ```
      */
      constructor(url, headers = {}, fetch$1) {
        const finalUrl = url.replace(/\/$/, "");
        const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), headers);
        super(finalUrl, finalHeaders, fetch$1, "storage");
      }
      /**
      * @alpha
      *
      * Creates a new analytics bucket using Iceberg tables
      * Analytics buckets are optimized for analytical queries and data processing
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param name A unique name for the bucket you are creating
      * @returns Promise with response containing newly created analytics bucket or error
      *
      * @example Create analytics bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .analytics
      *   .createBucket('analytics-data')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "name": "analytics-data",
      *     "type": "ANALYTICS",
      *     "format": "iceberg",
      *     "created_at": "2024-05-22T22:26:05.100Z",
      *     "updated_at": "2024-05-22T22:26:05.100Z"
      *   },
      *   "error": null
      * }
      * ```
      */
      async createBucket(name) {
        var _this = this;
        return _this.handleOperation(async () => {
          return await post(_this.fetch, `${_this.url}/bucket`, { name }, { headers: _this.headers });
        });
      }
      /**
      * @alpha
      *
      * Retrieves the details of all Analytics Storage buckets within an existing project
      * Only returns buckets of type 'ANALYTICS'
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param options Query parameters for listing buckets
      * @param options.limit Maximum number of buckets to return
      * @param options.offset Number of buckets to skip
      * @param options.sortColumn Column to sort by ('name', 'created_at', 'updated_at')
      * @param options.sortOrder Sort order ('asc' or 'desc')
      * @param options.search Search term to filter bucket names
      * @returns Promise with response containing array of analytics buckets or error
      *
      * @example List analytics buckets
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .analytics
      *   .listBuckets({
      *     limit: 10,
      *     offset: 0,
      *     sortColumn: 'created_at',
      *     sortOrder: 'desc'
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "analytics-data",
      *       "type": "ANALYTICS",
      *       "format": "iceberg",
      *       "created_at": "2024-05-22T22:26:05.100Z",
      *       "updated_at": "2024-05-22T22:26:05.100Z"
      *     }
      *   ],
      *   "error": null
      * }
      * ```
      */
      async listBuckets(options) {
        var _this2 = this;
        return _this2.handleOperation(async () => {
          const queryParams = new URLSearchParams();
          if ((options === null || options === void 0 ? void 0 : options.limit) !== void 0) queryParams.set("limit", options.limit.toString());
          if ((options === null || options === void 0 ? void 0 : options.offset) !== void 0) queryParams.set("offset", options.offset.toString());
          if (options === null || options === void 0 ? void 0 : options.sortColumn) queryParams.set("sortColumn", options.sortColumn);
          if (options === null || options === void 0 ? void 0 : options.sortOrder) queryParams.set("sortOrder", options.sortOrder);
          if (options === null || options === void 0 ? void 0 : options.search) queryParams.set("search", options.search);
          const queryString = queryParams.toString();
          const url = queryString ? `${_this2.url}/bucket?${queryString}` : `${_this2.url}/bucket`;
          return await get(_this2.fetch, url, { headers: _this2.headers });
        });
      }
      /**
      * @alpha
      *
      * Deletes an existing analytics bucket
      * A bucket can't be deleted with existing objects inside it
      * You must first empty the bucket before deletion
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param bucketName The unique identifier of the bucket you would like to delete
      * @returns Promise with response containing success message or error
      *
      * @example Delete analytics bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .analytics
      *   .deleteBucket('analytics-data')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully deleted"
      *   },
      *   "error": null
      * }
      * ```
      */
      async deleteBucket(bucketName) {
        var _this3 = this;
        return _this3.handleOperation(async () => {
          return await remove(_this3.fetch, `${_this3.url}/bucket/${bucketName}`, {}, { headers: _this3.headers });
        });
      }
      /**
      * @alpha
      *
      * Get an Iceberg REST Catalog client configured for a specific analytics bucket
      * Use this to perform advanced table and namespace operations within the bucket
      * The returned client provides full access to the Apache Iceberg REST Catalog API
      * with the Supabase `{ data, error }` pattern for consistent error handling on all operations.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param bucketName - The name of the analytics bucket (warehouse) to connect to
      * @returns The wrapped Iceberg catalog client
      * @throws {StorageError} If the bucket name is invalid
      *
      * @example Get catalog and create table
      * ```js
      * // First, create an analytics bucket
      * const { data: bucket, error: bucketError } = await supabase
      *   .storage
      *   .analytics
      *   .createBucket('analytics-data')
      *
      * // Get the Iceberg catalog for that bucket
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // Create a namespace
      * const { error: nsError } = await catalog.createNamespace({ namespace: ['default'] })
      *
      * // Create a table with schema
      * const { data: tableMetadata, error: tableError } = await catalog.createTable(
      *   { namespace: ['default'] },
      *   {
      *     name: 'events',
      *     schema: {
      *       type: 'struct',
      *       fields: [
      *         { id: 1, name: 'id', type: 'long', required: true },
      *         { id: 2, name: 'timestamp', type: 'timestamp', required: true },
      *         { id: 3, name: 'user_id', type: 'string', required: false }
      *       ],
      *       'schema-id': 0,
      *       'identifier-field-ids': [1]
      *     },
      *     'partition-spec': {
      *       'spec-id': 0,
      *       fields: []
      *     },
      *     'write-order': {
      *       'order-id': 0,
      *       fields: []
      *     },
      *     properties: {
      *       'write.format.default': 'parquet'
      *     }
      *   }
      * )
      * ```
      *
      * @example List tables in namespace
      * ```js
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // List all tables in the default namespace
      * const { data: tables, error: listError } = await catalog.listTables({ namespace: ['default'] })
      * if (listError) {
      *   if (listError.isNotFound()) {
      *     console.log('Namespace not found')
      *   }
      *   return
      * }
      * console.log(tables) // [{ namespace: ['default'], name: 'events' }]
      * ```
      *
      * @example Working with namespaces
      * ```js
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // List all namespaces
      * const { data: namespaces } = await catalog.listNamespaces()
      *
      * // Create namespace with properties
      * await catalog.createNamespace(
      *   { namespace: ['production'] },
      *   { properties: { owner: 'data-team', env: 'prod' } }
      * )
      * ```
      *
      * @example Cleanup operations
      * ```js
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // Drop table with purge option (removes all data)
      * const { error: dropError } = await catalog.dropTable(
      *   { namespace: ['default'], name: 'events' },
      *   { purge: true }
      * )
      *
      * if (dropError?.isNotFound()) {
      *   console.log('Table does not exist')
      * }
      *
      * // Drop namespace (must be empty)
      * await catalog.dropNamespace({ namespace: ['default'] })
      * ```
      *
      * @remarks
      * This method provides a bridge between Supabase's bucket management and the standard
      * Apache Iceberg REST Catalog API. The bucket name maps to the Iceberg warehouse parameter.
      * All authentication and configuration is handled automatically using your Supabase credentials.
      *
      * **Error Handling**: Invalid bucket names throw immediately. All catalog
      * operations return `{ data, error }` where errors are `IcebergError` instances from iceberg-js.
      * Use helper methods like `error.isNotFound()` or check `error.status` for specific error handling.
      * Use `.throwOnError()` on the analytics client if you prefer exceptions for catalog operations.
      *
      * **Cleanup Operations**: When using `dropTable`, the `purge: true` option permanently
      * deletes all table data. Without it, the table is marked as deleted but data remains.
      *
      * **Library Dependency**: The returned catalog wraps `IcebergRestCatalog` from iceberg-js.
      * For complete API documentation and advanced usage, refer to the
      * [iceberg-js documentation](https://supabase.github.io/iceberg-js/).
      */
      from(bucketName) {
        var _this4 = this;
        if (!isValidBucketName(bucketName)) throw new StorageError("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
        const catalog = new IcebergRestCatalog({
          baseUrl: this.url,
          catalogName: bucketName,
          auth: {
            type: "custom",
            getHeaders: async () => _this4.headers
          },
          fetch: this.fetch
        });
        const shouldThrowOnError = this.shouldThrowOnError;
        return new Proxy(catalog, { get(target, prop) {
          const value = target[prop];
          if (typeof value !== "function") return value;
          return async (...args) => {
            try {
              return {
                data: await value.apply(target, args),
                error: null
              };
            } catch (error) {
              if (shouldThrowOnError) throw error;
              return {
                data: null,
                error
              };
            }
          };
        } });
      }
    };
    VectorIndexApi = class extends BaseApiClient {
      /** Creates a new VectorIndexApi instance */
      constructor(url, headers = {}, fetch$1) {
        const finalUrl = url.replace(/\/$/, "");
        const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
        super(finalUrl, finalHeaders, fetch$1, "vectors");
      }
      /** Creates a new vector index within a bucket */
      async createIndex(options) {
        var _this = this;
        return _this.handleOperation(async () => {
          return await vectorsApi.post(_this.fetch, `${_this.url}/CreateIndex`, options, { headers: _this.headers }) || {};
        });
      }
      /** Retrieves metadata for a specific vector index */
      async getIndex(vectorBucketName, indexName) {
        var _this2 = this;
        return _this2.handleOperation(async () => {
          return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetIndex`, {
            vectorBucketName,
            indexName
          }, { headers: _this2.headers });
        });
      }
      /** Lists vector indexes within a bucket with optional filtering and pagination */
      async listIndexes(options) {
        var _this3 = this;
        return _this3.handleOperation(async () => {
          return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListIndexes`, options, { headers: _this3.headers });
        });
      }
      /** Deletes a vector index and all its data */
      async deleteIndex(vectorBucketName, indexName) {
        var _this4 = this;
        return _this4.handleOperation(async () => {
          return await vectorsApi.post(_this4.fetch, `${_this4.url}/DeleteIndex`, {
            vectorBucketName,
            indexName
          }, { headers: _this4.headers }) || {};
        });
      }
    };
    VectorDataApi = class extends BaseApiClient {
      /** Creates a new VectorDataApi instance */
      constructor(url, headers = {}, fetch$1) {
        const finalUrl = url.replace(/\/$/, "");
        const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
        super(finalUrl, finalHeaders, fetch$1, "vectors");
      }
      /** Inserts or updates vectors in batch (1-500 per request) */
      async putVectors(options) {
        var _this = this;
        if (options.vectors.length < 1 || options.vectors.length > 500) throw new Error("Vector batch size must be between 1 and 500 items");
        return _this.handleOperation(async () => {
          return await vectorsApi.post(_this.fetch, `${_this.url}/PutVectors`, options, { headers: _this.headers }) || {};
        });
      }
      /** Retrieves vectors by their keys in batch */
      async getVectors(options) {
        var _this2 = this;
        return _this2.handleOperation(async () => {
          return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetVectors`, options, { headers: _this2.headers });
        });
      }
      /** Lists vectors in an index with pagination */
      async listVectors(options) {
        var _this3 = this;
        if (options.segmentCount !== void 0) {
          if (options.segmentCount < 1 || options.segmentCount > 16) throw new Error("segmentCount must be between 1 and 16");
          if (options.segmentIndex !== void 0) {
            if (options.segmentIndex < 0 || options.segmentIndex >= options.segmentCount) throw new Error(`segmentIndex must be between 0 and ${options.segmentCount - 1}`);
          }
        }
        return _this3.handleOperation(async () => {
          return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListVectors`, options, { headers: _this3.headers });
        });
      }
      /** Queries for similar vectors using approximate nearest neighbor search */
      async queryVectors(options) {
        var _this4 = this;
        return _this4.handleOperation(async () => {
          return await vectorsApi.post(_this4.fetch, `${_this4.url}/QueryVectors`, options, { headers: _this4.headers });
        });
      }
      /** Deletes vectors by their keys in batch (1-500 per request) */
      async deleteVectors(options) {
        var _this5 = this;
        if (options.keys.length < 1 || options.keys.length > 500) throw new Error("Keys batch size must be between 1 and 500 items");
        return _this5.handleOperation(async () => {
          return await vectorsApi.post(_this5.fetch, `${_this5.url}/DeleteVectors`, options, { headers: _this5.headers }) || {};
        });
      }
    };
    VectorBucketApi = class extends BaseApiClient {
      /** Creates a new VectorBucketApi instance */
      constructor(url, headers = {}, fetch$1) {
        const finalUrl = url.replace(/\/$/, "");
        const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
        super(finalUrl, finalHeaders, fetch$1, "vectors");
      }
      /** Creates a new vector bucket */
      async createBucket(vectorBucketName) {
        var _this = this;
        return _this.handleOperation(async () => {
          return await vectorsApi.post(_this.fetch, `${_this.url}/CreateVectorBucket`, { vectorBucketName }, { headers: _this.headers }) || {};
        });
      }
      /** Retrieves metadata for a specific vector bucket */
      async getBucket(vectorBucketName) {
        var _this2 = this;
        return _this2.handleOperation(async () => {
          return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetVectorBucket`, { vectorBucketName }, { headers: _this2.headers });
        });
      }
      /** Lists vector buckets with optional filtering and pagination */
      async listBuckets(options = {}) {
        var _this3 = this;
        return _this3.handleOperation(async () => {
          return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListVectorBuckets`, options, { headers: _this3.headers });
        });
      }
      /** Deletes a vector bucket (must be empty first) */
      async deleteBucket(vectorBucketName) {
        var _this4 = this;
        return _this4.handleOperation(async () => {
          return await vectorsApi.post(_this4.fetch, `${_this4.url}/DeleteVectorBucket`, { vectorBucketName }, { headers: _this4.headers }) || {};
        });
      }
    };
    StorageVectorsClient = class extends VectorBucketApi {
      /**
      * @alpha
      *
      * Creates a StorageVectorsClient that can manage buckets, indexes, and vectors.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param url - Base URL of the Storage Vectors REST API.
      * @param options.headers - Optional headers (for example `Authorization`) applied to every request.
      * @param options.fetch - Optional custom `fetch` implementation for non-browser runtimes.
      *
      * @example
      * ```typescript
      * const client = new StorageVectorsClient(url, options)
      * ```
      */
      constructor(url, options = {}) {
        super(url, options.headers || {}, options.fetch);
      }
      /**
      *
      * @alpha
      *
      * Access operations for a specific vector bucket
      * Returns a scoped client for index and vector operations within the bucket
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Name of the vector bucket
      * @returns Bucket-scoped client with index and vector operations
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * ```
      */
      from(vectorBucketName) {
        return new VectorBucketScope(this.url, this.headers, vectorBucketName, this.fetch);
      }
      /**
      *
      * @alpha
      *
      * Creates a new vector bucket
      * Vector buckets are containers for vector indexes and their data
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Unique name for the vector bucket
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .createBucket('embeddings-prod')
      * ```
      */
      async createBucket(vectorBucketName) {
        var _superprop_getCreateBucket = () => super.createBucket, _this = this;
        return _superprop_getCreateBucket().call(_this, vectorBucketName);
      }
      /**
      *
      * @alpha
      *
      * Retrieves metadata for a specific vector bucket
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Name of the vector bucket
      * @returns Promise with bucket metadata or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .getBucket('embeddings-prod')
      *
      * console.log('Bucket created:', data?.vectorBucket.creationTime)
      * ```
      */
      async getBucket(vectorBucketName) {
        var _superprop_getGetBucket = () => super.getBucket, _this2 = this;
        return _superprop_getGetBucket().call(_this2, vectorBucketName);
      }
      /**
      *
      * @alpha
      *
      * Lists all vector buckets with optional filtering and pagination
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Optional filters (prefix, maxResults, nextToken)
      * @returns Promise with list of buckets or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .listBuckets({ prefix: 'embeddings-' })
      *
      * data?.vectorBuckets.forEach(bucket => {
      *   console.log(bucket.vectorBucketName)
      * })
      * ```
      */
      async listBuckets(options = {}) {
        var _superprop_getListBuckets = () => super.listBuckets, _this3 = this;
        return _superprop_getListBuckets().call(_this3, options);
      }
      /**
      *
      * @alpha
      *
      * Deletes a vector bucket (bucket must be empty)
      * All indexes must be deleted before deleting the bucket
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Name of the vector bucket to delete
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .deleteBucket('embeddings-old')
      * ```
      */
      async deleteBucket(vectorBucketName) {
        var _superprop_getDeleteBucket = () => super.deleteBucket, _this4 = this;
        return _superprop_getDeleteBucket().call(_this4, vectorBucketName);
      }
    };
    VectorBucketScope = class extends VectorIndexApi {
      /**
      * @alpha
      *
      * Creates a helper that automatically scopes all index operations to the provided bucket.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * ```
      */
      constructor(url, headers, vectorBucketName, fetch$1) {
        super(url, headers, fetch$1);
        this.vectorBucketName = vectorBucketName;
      }
      /**
      *
      * @alpha
      *
      * Creates a new vector index in this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Index configuration (vectorBucketName is automatically set)
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * await bucket.createIndex({
      *   indexName: 'documents-openai',
      *   dataType: 'float32',
      *   dimension: 1536,
      *   distanceMetric: 'cosine',
      *   metadataConfiguration: {
      *     nonFilterableMetadataKeys: ['raw_text']
      *   }
      * })
      * ```
      */
      async createIndex(options) {
        var _superprop_getCreateIndex = () => super.createIndex, _this5 = this;
        return _superprop_getCreateIndex().call(_this5, _objectSpread22(_objectSpread22({}, options), {}, { vectorBucketName: _this5.vectorBucketName }));
      }
      /**
      *
      * @alpha
      *
      * Lists indexes in this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Listing options (vectorBucketName is automatically set)
      * @returns Promise with response containing indexes array and pagination token or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * const { data } = await bucket.listIndexes({ prefix: 'documents-' })
      * ```
      */
      async listIndexes(options = {}) {
        var _superprop_getListIndexes = () => super.listIndexes, _this6 = this;
        return _superprop_getListIndexes().call(_this6, _objectSpread22(_objectSpread22({}, options), {}, { vectorBucketName: _this6.vectorBucketName }));
      }
      /**
      *
      * @alpha
      *
      * Retrieves metadata for a specific index in this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param indexName - Name of the index to retrieve
      * @returns Promise with index metadata or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * const { data } = await bucket.getIndex('documents-openai')
      * console.log('Dimension:', data?.index.dimension)
      * ```
      */
      async getIndex(indexName) {
        var _superprop_getGetIndex = () => super.getIndex, _this7 = this;
        return _superprop_getGetIndex().call(_this7, _this7.vectorBucketName, indexName);
      }
      /**
      *
      * @alpha
      *
      * Deletes an index from this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param indexName - Name of the index to delete
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * await bucket.deleteIndex('old-index')
      * ```
      */
      async deleteIndex(indexName) {
        var _superprop_getDeleteIndex = () => super.deleteIndex, _this8 = this;
        return _superprop_getDeleteIndex().call(_this8, _this8.vectorBucketName, indexName);
      }
      /**
      *
      * @alpha
      *
      * Access operations for a specific index within this bucket
      * Returns a scoped client for vector data operations
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param indexName - Name of the index
      * @returns Index-scoped client with vector data operations
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      *
      * // Insert vectors
      * await index.putVectors({
      *   vectors: [
      *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
      *   ]
      * })
      *
      * // Query similar vectors
      * const { data } = await index.queryVectors({
      *   queryVector: { float32: [...] },
      *   topK: 5
      * })
      * ```
      */
      index(indexName) {
        return new VectorIndexScope(this.url, this.headers, this.vectorBucketName, indexName, this.fetch);
      }
    };
    VectorIndexScope = class extends VectorDataApi {
      /**
      *
      * @alpha
      *
      * Creates a helper that automatically scopes all vector operations to the provided bucket/index names.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * ```
      */
      constructor(url, headers, vectorBucketName, indexName, fetch$1) {
        super(url, headers, fetch$1);
        this.vectorBucketName = vectorBucketName;
        this.indexName = indexName;
      }
      /**
      *
      * @alpha
      *
      * Inserts or updates vectors in this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Vector insertion options (bucket and index names automatically set)
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * await index.putVectors({
      *   vectors: [
      *     {
      *       key: 'doc-1',
      *       data: { float32: [0.1, 0.2, ...] },
      *       metadata: { title: 'Introduction', page: 1 }
      *     }
      *   ]
      * })
      * ```
      */
      async putVectors(options) {
        var _superprop_getPutVectors = () => super.putVectors, _this9 = this;
        return _superprop_getPutVectors().call(_this9, _objectSpread22(_objectSpread22({}, options), {}, {
          vectorBucketName: _this9.vectorBucketName,
          indexName: _this9.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Retrieves vectors by keys from this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Vector retrieval options (bucket and index names automatically set)
      * @returns Promise with response containing vectors array or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * const { data } = await index.getVectors({
      *   keys: ['doc-1', 'doc-2'],
      *   returnMetadata: true
      * })
      * ```
      */
      async getVectors(options) {
        var _superprop_getGetVectors = () => super.getVectors, _this10 = this;
        return _superprop_getGetVectors().call(_this10, _objectSpread22(_objectSpread22({}, options), {}, {
          vectorBucketName: _this10.vectorBucketName,
          indexName: _this10.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Lists vectors in this index with pagination
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Listing options (bucket and index names automatically set)
      * @returns Promise with response containing vectors array and pagination token or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * const { data } = await index.listVectors({
      *   maxResults: 500,
      *   returnMetadata: true
      * })
      * ```
      */
      async listVectors(options = {}) {
        var _superprop_getListVectors = () => super.listVectors, _this11 = this;
        return _superprop_getListVectors().call(_this11, _objectSpread22(_objectSpread22({}, options), {}, {
          vectorBucketName: _this11.vectorBucketName,
          indexName: _this11.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Queries for similar vectors in this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Query options (bucket and index names automatically set)
      * @returns Promise with response containing matches array of similar vectors ordered by distance or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * const { data } = await index.queryVectors({
      *   queryVector: { float32: [0.1, 0.2, ...] },
      *   topK: 5,
      *   filter: { category: 'technical' },
      *   returnDistance: true,
      *   returnMetadata: true
      * })
      * ```
      */
      async queryVectors(options) {
        var _superprop_getQueryVectors = () => super.queryVectors, _this12 = this;
        return _superprop_getQueryVectors().call(_this12, _objectSpread22(_objectSpread22({}, options), {}, {
          vectorBucketName: _this12.vectorBucketName,
          indexName: _this12.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Deletes vectors by keys from this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Deletion options (bucket and index names automatically set)
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * await index.deleteVectors({
      *   keys: ['doc-1', 'doc-2', 'doc-3']
      * })
      * ```
      */
      async deleteVectors(options) {
        var _superprop_getDeleteVectors = () => super.deleteVectors, _this13 = this;
        return _superprop_getDeleteVectors().call(_this13, _objectSpread22(_objectSpread22({}, options), {}, {
          vectorBucketName: _this13.vectorBucketName,
          indexName: _this13.indexName
        }));
      }
    };
    StorageClient = class extends StorageBucketApi {
      /**
      * Creates a client for Storage buckets, files, analytics, and vectors.
      *
      * @category File Buckets
      * @example
      * ```ts
      * import { StorageClient } from '@supabase/storage-js'
      *
      * const storage = new StorageClient('https://xyzcompany.supabase.co/storage/v1', {
      *   apikey: 'public-anon-key',
      * })
      * const avatars = storage.from('avatars')
      * ```
      */
      constructor(url, headers = {}, fetch$1, opts) {
        super(url, headers, fetch$1, opts);
      }
      /**
      * Perform file operation in a bucket.
      *
      * @category File Buckets
      * @param id The bucket id to operate on.
      *
      * @example
      * ```typescript
      * const avatars = supabase.storage.from('avatars')
      * ```
      */
      from(id) {
        return new StorageFileApi(this.url, this.headers, id, this.fetch);
      }
      /**
      *
      * @alpha
      *
      * Access vector storage operations.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @returns A StorageVectorsClient instance configured with the current storage settings.
      */
      get vectors() {
        return new StorageVectorsClient(this.url + "/vector", {
          headers: this.headers,
          fetch: this.fetch
        });
      }
      /**
      *
      * @alpha
      *
      * Access analytics storage operations using Iceberg tables.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @returns A StorageAnalyticsClient instance configured with the current storage settings.
      */
      get analytics() {
        return new StorageAnalyticsClient(this.url + "/iceberg", this.headers, this.fetch);
      }
    };
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/version.js
var require_version2 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/version.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.version = void 0;
    exports.version = "2.99.2";
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/constants.js
var require_constants2 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.JWKS_TTL = exports.BASE64URL_REGEX = exports.API_VERSIONS = exports.API_VERSION_HEADER_NAME = exports.NETWORK_FAILURE = exports.DEFAULT_HEADERS = exports.AUDIENCE = exports.STORAGE_KEY = exports.GOTRUE_URL = exports.EXPIRY_MARGIN_MS = exports.AUTO_REFRESH_TICK_THRESHOLD = exports.AUTO_REFRESH_TICK_DURATION_MS = void 0;
    var version_1 = require_version2();
    exports.AUTO_REFRESH_TICK_DURATION_MS = 30 * 1e3;
    exports.AUTO_REFRESH_TICK_THRESHOLD = 3;
    exports.EXPIRY_MARGIN_MS = exports.AUTO_REFRESH_TICK_THRESHOLD * exports.AUTO_REFRESH_TICK_DURATION_MS;
    exports.GOTRUE_URL = "http://localhost:9999";
    exports.STORAGE_KEY = "supabase.auth.token";
    exports.AUDIENCE = "";
    exports.DEFAULT_HEADERS = { "X-Client-Info": `gotrue-js/${version_1.version}` };
    exports.NETWORK_FAILURE = {
      MAX_RETRIES: 10,
      RETRY_INTERVAL: 2
      // in deciseconds
    };
    exports.API_VERSION_HEADER_NAME = "X-Supabase-Api-Version";
    exports.API_VERSIONS = {
      "2024-01-01": {
        timestamp: Date.parse("2024-01-01T00:00:00.0Z"),
        name: "2024-01-01"
      }
    };
    exports.BASE64URL_REGEX = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i;
    exports.JWKS_TTL = 10 * 60 * 1e3;
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/errors.js
var require_errors = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AuthInvalidJwtError = exports.AuthWeakPasswordError = exports.AuthRetryableFetchError = exports.AuthPKCECodeVerifierMissingError = exports.AuthPKCEGrantCodeExchangeError = exports.AuthImplicitGrantRedirectError = exports.AuthInvalidCredentialsError = exports.AuthInvalidTokenResponseError = exports.AuthSessionMissingError = exports.CustomAuthError = exports.AuthUnknownError = exports.AuthApiError = exports.AuthError = void 0;
    exports.isAuthError = isAuthError;
    exports.isAuthApiError = isAuthApiError;
    exports.isAuthSessionMissingError = isAuthSessionMissingError;
    exports.isAuthImplicitGrantRedirectError = isAuthImplicitGrantRedirectError;
    exports.isAuthPKCECodeVerifierMissingError = isAuthPKCECodeVerifierMissingError;
    exports.isAuthRetryableFetchError = isAuthRetryableFetchError;
    exports.isAuthWeakPasswordError = isAuthWeakPasswordError;
    var AuthError = class extends Error {
      constructor(message, status, code) {
        super(message);
        this.__isAuthError = true;
        this.name = "AuthError";
        this.status = status;
        this.code = code;
      }
    };
    exports.AuthError = AuthError;
    function isAuthError(error) {
      return typeof error === "object" && error !== null && "__isAuthError" in error;
    }
    var AuthApiError = class extends AuthError {
      constructor(message, status, code) {
        super(message, status, code);
        this.name = "AuthApiError";
        this.status = status;
        this.code = code;
      }
    };
    exports.AuthApiError = AuthApiError;
    function isAuthApiError(error) {
      return isAuthError(error) && error.name === "AuthApiError";
    }
    var AuthUnknownError = class extends AuthError {
      constructor(message, originalError) {
        super(message);
        this.name = "AuthUnknownError";
        this.originalError = originalError;
      }
    };
    exports.AuthUnknownError = AuthUnknownError;
    var CustomAuthError = class extends AuthError {
      constructor(message, name, status, code) {
        super(message, status, code);
        this.name = name;
        this.status = status;
      }
    };
    exports.CustomAuthError = CustomAuthError;
    var AuthSessionMissingError = class extends CustomAuthError {
      constructor() {
        super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
      }
    };
    exports.AuthSessionMissingError = AuthSessionMissingError;
    function isAuthSessionMissingError(error) {
      return isAuthError(error) && error.name === "AuthSessionMissingError";
    }
    var AuthInvalidTokenResponseError = class extends CustomAuthError {
      constructor() {
        super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
      }
    };
    exports.AuthInvalidTokenResponseError = AuthInvalidTokenResponseError;
    var AuthInvalidCredentialsError = class extends CustomAuthError {
      constructor(message) {
        super(message, "AuthInvalidCredentialsError", 400, void 0);
      }
    };
    exports.AuthInvalidCredentialsError = AuthInvalidCredentialsError;
    var AuthImplicitGrantRedirectError = class extends CustomAuthError {
      constructor(message, details = null) {
        super(message, "AuthImplicitGrantRedirectError", 500, void 0);
        this.details = null;
        this.details = details;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          status: this.status,
          details: this.details
        };
      }
    };
    exports.AuthImplicitGrantRedirectError = AuthImplicitGrantRedirectError;
    function isAuthImplicitGrantRedirectError(error) {
      return isAuthError(error) && error.name === "AuthImplicitGrantRedirectError";
    }
    var AuthPKCEGrantCodeExchangeError = class extends CustomAuthError {
      constructor(message, details = null) {
        super(message, "AuthPKCEGrantCodeExchangeError", 500, void 0);
        this.details = null;
        this.details = details;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          status: this.status,
          details: this.details
        };
      }
    };
    exports.AuthPKCEGrantCodeExchangeError = AuthPKCEGrantCodeExchangeError;
    var AuthPKCECodeVerifierMissingError = class extends CustomAuthError {
      constructor() {
        super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
      }
    };
    exports.AuthPKCECodeVerifierMissingError = AuthPKCECodeVerifierMissingError;
    function isAuthPKCECodeVerifierMissingError(error) {
      return isAuthError(error) && error.name === "AuthPKCECodeVerifierMissingError";
    }
    var AuthRetryableFetchError = class extends CustomAuthError {
      constructor(message, status) {
        super(message, "AuthRetryableFetchError", status, void 0);
      }
    };
    exports.AuthRetryableFetchError = AuthRetryableFetchError;
    function isAuthRetryableFetchError(error) {
      return isAuthError(error) && error.name === "AuthRetryableFetchError";
    }
    var AuthWeakPasswordError = class extends CustomAuthError {
      constructor(message, status, reasons) {
        super(message, "AuthWeakPasswordError", status, "weak_password");
        this.reasons = reasons;
      }
    };
    exports.AuthWeakPasswordError = AuthWeakPasswordError;
    function isAuthWeakPasswordError(error) {
      return isAuthError(error) && error.name === "AuthWeakPasswordError";
    }
    var AuthInvalidJwtError = class extends CustomAuthError {
      constructor(message) {
        super(message, "AuthInvalidJwtError", 400, "invalid_jwt");
      }
    };
    exports.AuthInvalidJwtError = AuthInvalidJwtError;
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/base64url.js
var require_base64url = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/base64url.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.byteToBase64URL = byteToBase64URL;
    exports.byteFromBase64URL = byteFromBase64URL;
    exports.stringToBase64URL = stringToBase64URL;
    exports.stringFromBase64URL = stringFromBase64URL;
    exports.codepointToUTF8 = codepointToUTF8;
    exports.stringToUTF8 = stringToUTF8;
    exports.stringFromUTF8 = stringFromUTF8;
    exports.base64UrlToUint8Array = base64UrlToUint8Array;
    exports.stringToUint8Array = stringToUint8Array;
    exports.bytesToBase64URL = bytesToBase64URL;
    var TO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
    var IGNORE_BASE64URL = " 	\n\r=".split("");
    var FROM_BASE64URL = (() => {
      const charMap = new Array(128);
      for (let i = 0; i < charMap.length; i += 1) {
        charMap[i] = -1;
      }
      for (let i = 0; i < IGNORE_BASE64URL.length; i += 1) {
        charMap[IGNORE_BASE64URL[i].charCodeAt(0)] = -2;
      }
      for (let i = 0; i < TO_BASE64URL.length; i += 1) {
        charMap[TO_BASE64URL[i].charCodeAt(0)] = i;
      }
      return charMap;
    })();
    function byteToBase64URL(byte, state, emit) {
      if (byte !== null) {
        state.queue = state.queue << 8 | byte;
        state.queuedBits += 8;
        while (state.queuedBits >= 6) {
          const pos = state.queue >> state.queuedBits - 6 & 63;
          emit(TO_BASE64URL[pos]);
          state.queuedBits -= 6;
        }
      } else if (state.queuedBits > 0) {
        state.queue = state.queue << 6 - state.queuedBits;
        state.queuedBits = 6;
        while (state.queuedBits >= 6) {
          const pos = state.queue >> state.queuedBits - 6 & 63;
          emit(TO_BASE64URL[pos]);
          state.queuedBits -= 6;
        }
      }
    }
    function byteFromBase64URL(charCode, state, emit) {
      const bits = FROM_BASE64URL[charCode];
      if (bits > -1) {
        state.queue = state.queue << 6 | bits;
        state.queuedBits += 6;
        while (state.queuedBits >= 8) {
          emit(state.queue >> state.queuedBits - 8 & 255);
          state.queuedBits -= 8;
        }
      } else if (bits === -2) {
        return;
      } else {
        throw new Error(`Invalid Base64-URL character "${String.fromCharCode(charCode)}"`);
      }
    }
    function stringToBase64URL(str) {
      const base64 = [];
      const emitter = (char) => {
        base64.push(char);
      };
      const state = { queue: 0, queuedBits: 0 };
      stringToUTF8(str, (byte) => {
        byteToBase64URL(byte, state, emitter);
      });
      byteToBase64URL(null, state, emitter);
      return base64.join("");
    }
    function stringFromBase64URL(str) {
      const conv = [];
      const utf8Emit = (codepoint) => {
        conv.push(String.fromCodePoint(codepoint));
      };
      const utf8State = {
        utf8seq: 0,
        codepoint: 0
      };
      const b64State = { queue: 0, queuedBits: 0 };
      const byteEmit = (byte) => {
        stringFromUTF8(byte, utf8State, utf8Emit);
      };
      for (let i = 0; i < str.length; i += 1) {
        byteFromBase64URL(str.charCodeAt(i), b64State, byteEmit);
      }
      return conv.join("");
    }
    function codepointToUTF8(codepoint, emit) {
      if (codepoint <= 127) {
        emit(codepoint);
        return;
      } else if (codepoint <= 2047) {
        emit(192 | codepoint >> 6);
        emit(128 | codepoint & 63);
        return;
      } else if (codepoint <= 65535) {
        emit(224 | codepoint >> 12);
        emit(128 | codepoint >> 6 & 63);
        emit(128 | codepoint & 63);
        return;
      } else if (codepoint <= 1114111) {
        emit(240 | codepoint >> 18);
        emit(128 | codepoint >> 12 & 63);
        emit(128 | codepoint >> 6 & 63);
        emit(128 | codepoint & 63);
        return;
      }
      throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
    }
    function stringToUTF8(str, emit) {
      for (let i = 0; i < str.length; i += 1) {
        let codepoint = str.charCodeAt(i);
        if (codepoint > 55295 && codepoint <= 56319) {
          const highSurrogate = (codepoint - 55296) * 1024 & 65535;
          const lowSurrogate = str.charCodeAt(i + 1) - 56320 & 65535;
          codepoint = (lowSurrogate | highSurrogate) + 65536;
          i += 1;
        }
        codepointToUTF8(codepoint, emit);
      }
    }
    function stringFromUTF8(byte, state, emit) {
      if (state.utf8seq === 0) {
        if (byte <= 127) {
          emit(byte);
          return;
        }
        for (let leadingBit = 1; leadingBit < 6; leadingBit += 1) {
          if ((byte >> 7 - leadingBit & 1) === 0) {
            state.utf8seq = leadingBit;
            break;
          }
        }
        if (state.utf8seq === 2) {
          state.codepoint = byte & 31;
        } else if (state.utf8seq === 3) {
          state.codepoint = byte & 15;
        } else if (state.utf8seq === 4) {
          state.codepoint = byte & 7;
        } else {
          throw new Error("Invalid UTF-8 sequence");
        }
        state.utf8seq -= 1;
      } else if (state.utf8seq > 0) {
        if (byte <= 127) {
          throw new Error("Invalid UTF-8 sequence");
        }
        state.codepoint = state.codepoint << 6 | byte & 63;
        state.utf8seq -= 1;
        if (state.utf8seq === 0) {
          emit(state.codepoint);
        }
      }
    }
    function base64UrlToUint8Array(str) {
      const result = [];
      const state = { queue: 0, queuedBits: 0 };
      const onByte = (byte) => {
        result.push(byte);
      };
      for (let i = 0; i < str.length; i += 1) {
        byteFromBase64URL(str.charCodeAt(i), state, onByte);
      }
      return new Uint8Array(result);
    }
    function stringToUint8Array(str) {
      const result = [];
      stringToUTF8(str, (byte) => result.push(byte));
      return new Uint8Array(result);
    }
    function bytesToBase64URL(bytes) {
      const result = [];
      const state = { queue: 0, queuedBits: 0 };
      const onChar = (char) => {
        result.push(char);
      };
      bytes.forEach((byte) => byteToBase64URL(byte, state, onChar));
      byteToBase64URL(null, state, onChar);
      return result.join("");
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/helpers.js
var require_helpers = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/helpers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Deferred = exports.removeItemAsync = exports.getItemAsync = exports.setItemAsync = exports.looksLikeFetchResponse = exports.resolveFetch = exports.supportsLocalStorage = exports.isBrowser = void 0;
    exports.expiresAt = expiresAt;
    exports.generateCallbackId = generateCallbackId;
    exports.parseParametersFromURL = parseParametersFromURL;
    exports.decodeJWT = decodeJWT;
    exports.sleep = sleep;
    exports.retryable = retryable;
    exports.generatePKCEVerifier = generatePKCEVerifier;
    exports.generatePKCEChallenge = generatePKCEChallenge;
    exports.getCodeChallengeAndMethod = getCodeChallengeAndMethod;
    exports.parseResponseAPIVersion = parseResponseAPIVersion;
    exports.validateExp = validateExp;
    exports.getAlgorithm = getAlgorithm;
    exports.validateUUID = validateUUID;
    exports.userNotAvailableProxy = userNotAvailableProxy;
    exports.insecureUserWarningProxy = insecureUserWarningProxy;
    exports.deepClone = deepClone;
    var constants_1 = require_constants2();
    var errors_1 = require_errors();
    var base64url_1 = require_base64url();
    function expiresAt(expiresIn) {
      const timeNow = Math.round(Date.now() / 1e3);
      return timeNow + expiresIn;
    }
    function generateCallbackId() {
      return /* @__PURE__ */ Symbol("auth-callback");
    }
    var isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";
    exports.isBrowser = isBrowser;
    var localStorageWriteTests = {
      tested: false,
      writable: false
    };
    var supportsLocalStorage = () => {
      if (!(0, exports.isBrowser)()) {
        return false;
      }
      try {
        if (typeof globalThis.localStorage !== "object") {
          return false;
        }
      } catch (e) {
        return false;
      }
      if (localStorageWriteTests.tested) {
        return localStorageWriteTests.writable;
      }
      const randomKey = `lswt-${Math.random()}${Math.random()}`;
      try {
        globalThis.localStorage.setItem(randomKey, randomKey);
        globalThis.localStorage.removeItem(randomKey);
        localStorageWriteTests.tested = true;
        localStorageWriteTests.writable = true;
      } catch (e) {
        localStorageWriteTests.tested = true;
        localStorageWriteTests.writable = false;
      }
      return localStorageWriteTests.writable;
    };
    exports.supportsLocalStorage = supportsLocalStorage;
    function parseParametersFromURL(href) {
      const result = {};
      const url = new URL(href);
      if (url.hash && url.hash[0] === "#") {
        try {
          const hashSearchParams = new URLSearchParams(url.hash.substring(1));
          hashSearchParams.forEach((value, key) => {
            result[key] = value;
          });
        } catch (e) {
        }
      }
      url.searchParams.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    var resolveFetch3 = (customFetch) => {
      if (customFetch) {
        return (...args) => customFetch(...args);
      }
      return (...args) => fetch(...args);
    };
    exports.resolveFetch = resolveFetch3;
    var looksLikeFetchResponse = (maybeResponse) => {
      return typeof maybeResponse === "object" && maybeResponse !== null && "status" in maybeResponse && "ok" in maybeResponse && "json" in maybeResponse && typeof maybeResponse.json === "function";
    };
    exports.looksLikeFetchResponse = looksLikeFetchResponse;
    var setItemAsync = async (storage, key, data) => {
      await storage.setItem(key, JSON.stringify(data));
    };
    exports.setItemAsync = setItemAsync;
    var getItemAsync = async (storage, key) => {
      const value = await storage.getItem(key);
      if (!value) {
        return null;
      }
      try {
        return JSON.parse(value);
      } catch (_a) {
        return value;
      }
    };
    exports.getItemAsync = getItemAsync;
    var removeItemAsync = async (storage, key) => {
      await storage.removeItem(key);
    };
    exports.removeItemAsync = removeItemAsync;
    var Deferred = class _Deferred {
      constructor() {
        ;
        this.promise = new _Deferred.promiseConstructor((res, rej) => {
          ;
          this.resolve = res;
          this.reject = rej;
        });
      }
    };
    exports.Deferred = Deferred;
    Deferred.promiseConstructor = Promise;
    function decodeJWT(token) {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new errors_1.AuthInvalidJwtError("Invalid JWT structure");
      }
      for (let i = 0; i < parts.length; i++) {
        if (!constants_1.BASE64URL_REGEX.test(parts[i])) {
          throw new errors_1.AuthInvalidJwtError("JWT not in base64url format");
        }
      }
      const data = {
        // using base64url lib
        header: JSON.parse((0, base64url_1.stringFromBase64URL)(parts[0])),
        payload: JSON.parse((0, base64url_1.stringFromBase64URL)(parts[1])),
        signature: (0, base64url_1.base64UrlToUint8Array)(parts[2]),
        raw: {
          header: parts[0],
          payload: parts[1]
        }
      };
      return data;
    }
    async function sleep(time) {
      return await new Promise((accept) => {
        setTimeout(() => accept(null), time);
      });
    }
    function retryable(fn, isRetryable) {
      const promise = new Promise((accept, reject) => {
        ;
        (async () => {
          for (let attempt = 0; attempt < Infinity; attempt++) {
            try {
              const result = await fn(attempt);
              if (!isRetryable(attempt, null, result)) {
                accept(result);
                return;
              }
            } catch (e) {
              if (!isRetryable(attempt, e)) {
                reject(e);
                return;
              }
            }
          }
        })();
      });
      return promise;
    }
    function dec2hex(dec) {
      return ("0" + dec.toString(16)).substr(-2);
    }
    function generatePKCEVerifier() {
      const verifierLength = 56;
      const array = new Uint32Array(verifierLength);
      if (typeof crypto === "undefined") {
        const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        const charSetLen = charSet.length;
        let verifier = "";
        for (let i = 0; i < verifierLength; i++) {
          verifier += charSet.charAt(Math.floor(Math.random() * charSetLen));
        }
        return verifier;
      }
      crypto.getRandomValues(array);
      return Array.from(array, dec2hex).join("");
    }
    async function sha256(randomString) {
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(randomString);
      const hash = await crypto.subtle.digest("SHA-256", encodedData);
      const bytes = new Uint8Array(hash);
      return Array.from(bytes).map((c) => String.fromCharCode(c)).join("");
    }
    async function generatePKCEChallenge(verifier) {
      const hasCryptoSupport = typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined" && typeof TextEncoder !== "undefined";
      if (!hasCryptoSupport) {
        console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.");
        return verifier;
      }
      const hashed = await sha256(verifier);
      return btoa(hashed).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    async function getCodeChallengeAndMethod(storage, storageKey, isPasswordRecovery = false) {
      const codeVerifier = generatePKCEVerifier();
      let storedCodeVerifier = codeVerifier;
      if (isPasswordRecovery) {
        storedCodeVerifier += "/PASSWORD_RECOVERY";
      }
      await (0, exports.setItemAsync)(storage, `${storageKey}-code-verifier`, storedCodeVerifier);
      const codeChallenge = await generatePKCEChallenge(codeVerifier);
      const codeChallengeMethod = codeVerifier === codeChallenge ? "plain" : "s256";
      return [codeChallenge, codeChallengeMethod];
    }
    var API_VERSION_REGEX = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
    function parseResponseAPIVersion(response) {
      const apiVersion = response.headers.get(constants_1.API_VERSION_HEADER_NAME);
      if (!apiVersion) {
        return null;
      }
      if (!apiVersion.match(API_VERSION_REGEX)) {
        return null;
      }
      try {
        const date = /* @__PURE__ */ new Date(`${apiVersion}T00:00:00.0Z`);
        return date;
      } catch (e) {
        return null;
      }
    }
    function validateExp(exp) {
      if (!exp) {
        throw new Error("Missing exp claim");
      }
      const timeNow = Math.floor(Date.now() / 1e3);
      if (exp <= timeNow) {
        throw new Error("JWT has expired");
      }
    }
    function getAlgorithm(alg) {
      switch (alg) {
        case "RS256":
          return {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: "SHA-256" }
          };
        case "ES256":
          return {
            name: "ECDSA",
            namedCurve: "P-256",
            hash: { name: "SHA-256" }
          };
        default:
          throw new Error("Invalid alg claim");
      }
    }
    var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    function validateUUID(str) {
      if (!UUID_REGEX.test(str)) {
        throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not");
      }
    }
    function userNotAvailableProxy() {
      const proxyTarget = {};
      return new Proxy(proxyTarget, {
        get: (target, prop) => {
          if (prop === "__isUserNotAvailableProxy") {
            return true;
          }
          if (typeof prop === "symbol") {
            const sProp = prop.toString();
            if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)") {
              return void 0;
            }
          }
          throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${prop}" property of the session object is not supported. Please use getUser() instead.`);
        },
        set: (_target, prop) => {
          throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
        },
        deleteProperty: (_target, prop) => {
          throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
        }
      });
    }
    function insecureUserWarningProxy(user, suppressWarningRef) {
      return new Proxy(user, {
        get: (target, prop, receiver) => {
          if (prop === "__isInsecureUserWarningProxy") {
            return true;
          }
          if (typeof prop === "symbol") {
            const sProp = prop.toString();
            if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)" || sProp === "Symbol(nodejs.util.inspect.custom)") {
              return Reflect.get(target, prop, receiver);
            }
          }
          if (!suppressWarningRef.value && typeof prop === "string") {
            console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.");
            suppressWarningRef.value = true;
          }
          return Reflect.get(target, prop, receiver);
        }
      });
    }
    function deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/fetch.js
var require_fetch = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/fetch.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.handleError = handleError2;
    exports._request = _request;
    exports._sessionResponse = _sessionResponse;
    exports._sessionResponsePassword = _sessionResponsePassword;
    exports._userResponse = _userResponse;
    exports._ssoResponse = _ssoResponse;
    exports._generateLinkResponse = _generateLinkResponse;
    exports._noResolveJsonResponse = _noResolveJsonResponse;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var constants_1 = require_constants2();
    var helpers_1 = require_helpers();
    var errors_1 = require_errors();
    var _getErrorMessage2 = (err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
    var NETWORK_ERROR_CODES = [502, 503, 504];
    async function handleError2(error) {
      var _a;
      if (!(0, helpers_1.looksLikeFetchResponse)(error)) {
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage2(error), 0);
      }
      if (NETWORK_ERROR_CODES.includes(error.status)) {
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage2(error), error.status);
      }
      let data;
      try {
        data = await error.json();
      } catch (e) {
        throw new errors_1.AuthUnknownError(_getErrorMessage2(e), e);
      }
      let errorCode = void 0;
      const responseAPIVersion = (0, helpers_1.parseResponseAPIVersion)(error);
      if (responseAPIVersion && responseAPIVersion.getTime() >= constants_1.API_VERSIONS["2024-01-01"].timestamp && typeof data === "object" && data && typeof data.code === "string") {
        errorCode = data.code;
      } else if (typeof data === "object" && data && typeof data.error_code === "string") {
        errorCode = data.error_code;
      }
      if (!errorCode) {
        if (typeof data === "object" && data && typeof data.weak_password === "object" && data.weak_password && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
          throw new errors_1.AuthWeakPasswordError(_getErrorMessage2(data), error.status, data.weak_password.reasons);
        }
      } else if (errorCode === "weak_password") {
        throw new errors_1.AuthWeakPasswordError(_getErrorMessage2(data), error.status, ((_a = data.weak_password) === null || _a === void 0 ? void 0 : _a.reasons) || []);
      } else if (errorCode === "session_not_found") {
        throw new errors_1.AuthSessionMissingError();
      }
      throw new errors_1.AuthApiError(_getErrorMessage2(data), error.status || 500, errorCode);
    }
    var _getRequestParams2 = (method, options, parameters, body) => {
      const params = { method, headers: (options === null || options === void 0 ? void 0 : options.headers) || {} };
      if (method === "GET") {
        return params;
      }
      params.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, options === null || options === void 0 ? void 0 : options.headers);
      params.body = JSON.stringify(body);
      return Object.assign(Object.assign({}, params), parameters);
    };
    async function _request(fetcher, method, url, options) {
      var _a;
      const headers = Object.assign({}, options === null || options === void 0 ? void 0 : options.headers);
      if (!headers[constants_1.API_VERSION_HEADER_NAME]) {
        headers[constants_1.API_VERSION_HEADER_NAME] = constants_1.API_VERSIONS["2024-01-01"].name;
      }
      if (options === null || options === void 0 ? void 0 : options.jwt) {
        headers["Authorization"] = `Bearer ${options.jwt}`;
      }
      const qs = (_a = options === null || options === void 0 ? void 0 : options.query) !== null && _a !== void 0 ? _a : {};
      if (options === null || options === void 0 ? void 0 : options.redirectTo) {
        qs["redirect_to"] = options.redirectTo;
      }
      const queryString = Object.keys(qs).length ? "?" + new URLSearchParams(qs).toString() : "";
      const data = await _handleRequest2(fetcher, method, url + queryString, {
        headers,
        noResolveJson: options === null || options === void 0 ? void 0 : options.noResolveJson
      }, {}, options === null || options === void 0 ? void 0 : options.body);
      return (options === null || options === void 0 ? void 0 : options.xform) ? options === null || options === void 0 ? void 0 : options.xform(data) : { data: Object.assign({}, data), error: null };
    }
    async function _handleRequest2(fetcher, method, url, options, parameters, body) {
      const requestParams = _getRequestParams2(method, options, parameters, body);
      let result;
      try {
        result = await fetcher(url, Object.assign({}, requestParams));
      } catch (e) {
        console.error(e);
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage2(e), 0);
      }
      if (!result.ok) {
        await handleError2(result);
      }
      if (options === null || options === void 0 ? void 0 : options.noResolveJson) {
        return result;
      }
      try {
        return await result.json();
      } catch (e) {
        await handleError2(e);
      }
    }
    function _sessionResponse(data) {
      var _a;
      let session = null;
      if (hasSession(data)) {
        session = Object.assign({}, data);
        if (!data.expires_at) {
          session.expires_at = (0, helpers_1.expiresAt)(data.expires_in);
        }
      }
      const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
      return { data: { session, user }, error: null };
    }
    function _sessionResponsePassword(data) {
      const response = _sessionResponse(data);
      if (!response.error && data.weak_password && typeof data.weak_password === "object" && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.message && typeof data.weak_password.message === "string" && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
        response.data.weak_password = data.weak_password;
      }
      return response;
    }
    function _userResponse(data) {
      var _a;
      const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
      return { data: { user }, error: null };
    }
    function _ssoResponse(data) {
      return { data, error: null };
    }
    function _generateLinkResponse(data) {
      const { action_link, email_otp, hashed_token, redirect_to, verification_type } = data, rest = tslib_1.__rest(data, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]);
      const properties = {
        action_link,
        email_otp,
        hashed_token,
        redirect_to,
        verification_type
      };
      const user = Object.assign({}, rest);
      return {
        data: {
          properties,
          user
        },
        error: null
      };
    }
    function _noResolveJsonResponse(data) {
      return data;
    }
    function hasSession(data) {
      return data.access_token && data.refresh_token && data.expires_in;
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/types.js
var require_types2 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SIGN_OUT_SCOPES = void 0;
    exports.SIGN_OUT_SCOPES = ["global", "local", "others"];
  }
});

// node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.js
var require_GoTrueAdminApi = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var fetch_1 = require_fetch();
    var helpers_1 = require_helpers();
    var types_1 = require_types2();
    var errors_1 = require_errors();
    var GoTrueAdminApi = class {
      /**
       * Creates an admin API client that can be used to manage users and OAuth clients.
       *
       * @example
       * ```ts
       * import { GoTrueAdminApi } from '@supabase/auth-js'
       *
       * const admin = new GoTrueAdminApi({
       *   url: 'https://xyzcompany.supabase.co/auth/v1',
       *   headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
       * })
       * ```
       */
      constructor({ url = "", headers = {}, fetch: fetch2 }) {
        this.url = url;
        this.headers = headers;
        this.fetch = (0, helpers_1.resolveFetch)(fetch2);
        this.mfa = {
          listFactors: this._listFactors.bind(this),
          deleteFactor: this._deleteFactor.bind(this)
        };
        this.oauth = {
          listClients: this._listOAuthClients.bind(this),
          createClient: this._createOAuthClient.bind(this),
          getClient: this._getOAuthClient.bind(this),
          updateClient: this._updateOAuthClient.bind(this),
          deleteClient: this._deleteOAuthClient.bind(this),
          regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
        };
        this.customProviders = {
          listProviders: this._listCustomProviders.bind(this),
          createProvider: this._createCustomProvider.bind(this),
          getProvider: this._getCustomProvider.bind(this),
          updateProvider: this._updateCustomProvider.bind(this),
          deleteProvider: this._deleteCustomProvider.bind(this)
        };
      }
      /**
       * Removes a logged-in session.
       * @param jwt A valid, logged-in JWT.
       * @param scope The logout sope.
       */
      async signOut(jwt, scope = types_1.SIGN_OUT_SCOPES[0]) {
        if (types_1.SIGN_OUT_SCOPES.indexOf(scope) < 0) {
          throw new Error(`@supabase/auth-js: Parameter scope must be one of ${types_1.SIGN_OUT_SCOPES.join(", ")}`);
        }
        try {
          await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/logout?scope=${scope}`, {
            headers: this.headers,
            jwt,
            noResolveJson: true
          });
          return { data: null, error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Sends an invite link to an email address.
       * @param email The email address of the user.
       * @param options Additional options to be included when inviting.
       */
      async inviteUserByEmail(email, options = {}) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/invite`, {
            body: { email, data: options.data },
            headers: this.headers,
            redirectTo: options.redirectTo,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Generates email links and OTPs to be sent via a custom email provider.
       * @param email The user's email.
       * @param options.password User password. For signup only.
       * @param options.data Optional user metadata. For signup only.
       * @param options.redirectTo The redirect url which should be appended to the generated link
       */
      async generateLink(params) {
        try {
          const { options } = params, rest = tslib_1.__rest(params, ["options"]);
          const body = Object.assign(Object.assign({}, rest), options);
          if ("newEmail" in rest) {
            body.new_email = rest === null || rest === void 0 ? void 0 : rest.newEmail;
            delete body["newEmail"];
          }
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/generate_link`, {
            body,
            headers: this.headers,
            xform: fetch_1._generateLinkResponse,
            redirectTo: options === null || options === void 0 ? void 0 : options.redirectTo
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return {
              data: {
                properties: null,
                user: null
              },
              error
            };
          }
          throw error;
        }
      }
      // User Admin API
      /**
       * Creates a new user.
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async createUser(attributes) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/users`, {
            body: attributes,
            headers: this.headers,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Get a list of users.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       * @param params An object which supports `page` and `perPage` as numbers, to alter the paginated results.
       */
      async listUsers(params) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
          const pagination = { nextPage: null, lastPage: 0, total: 0 };
          const response = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/users`, {
            headers: this.headers,
            noResolveJson: true,
            query: {
              page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
              per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
            },
            xform: fetch_1._noResolveJsonResponse
          });
          if (response.error)
            throw response.error;
          const users = await response.json();
          const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
          const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
          if (links.length > 0) {
            links.forEach((link) => {
              const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
              const rel = JSON.parse(link.split(";")[1].split("=")[1]);
              pagination[`${rel}Page`] = page;
            });
            pagination.total = parseInt(total);
          }
          return { data: Object.assign(Object.assign({}, users), pagination), error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { users: [] }, error };
          }
          throw error;
        }
      }
      /**
       * Get user by id.
       *
       * @param uid The user's unique identifier
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async getUserById(uid) {
        (0, helpers_1.validateUUID)(uid);
        try {
          return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/users/${uid}`, {
            headers: this.headers,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Updates the user data. Changes are applied directly without confirmation flows.
       *
       * @param uid The user's unique identifier
       * @param attributes The data you want to update.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       *
       * @remarks
       * **Important:** This is a server-side operation and does **not** trigger client-side
       * `onAuthStateChange` listeners. The admin API has no connection to client state.
       *
       * To sync changes to the client after calling this method:
       * 1. On the client, call `supabase.auth.refreshSession()` to fetch the updated user data
       * 2. This will trigger the `TOKEN_REFRESHED` event and notify all listeners
       *
       * @example
       * ```typescript
       * // Server-side (Edge Function)
       * const { data, error } = await supabase.auth.admin.updateUserById(
       *   userId,
       *   { user_metadata: { preferences: { theme: 'dark' } } }
       * )
       *
       * // Client-side (to sync the changes)
       * const { data, error } = await supabase.auth.refreshSession()
       * // onAuthStateChange listeners will now be notified with updated user
       * ```
       *
       * @see {@link GoTrueClient.refreshSession} for syncing admin changes to the client
       * @see {@link GoTrueClient.updateUser} for client-side user updates (triggers listeners automatically)
       */
      async updateUserById(uid, attributes) {
        (0, helpers_1.validateUUID)(uid);
        try {
          return await (0, fetch_1._request)(this.fetch, "PUT", `${this.url}/admin/users/${uid}`, {
            body: attributes,
            headers: this.headers,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Delete a user. Requires a `service_role` key.
       *
       * @param id The user id you want to remove.
       * @param shouldSoftDelete If true, then the user will be soft-deleted from the auth schema. Soft deletion allows user identification from the hashed user ID but is not reversible.
       * Defaults to false for backward compatibility.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async deleteUser(id, shouldSoftDelete = false) {
        (0, helpers_1.validateUUID)(id);
        try {
          return await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/admin/users/${id}`, {
            headers: this.headers,
            body: {
              should_soft_delete: shouldSoftDelete
            },
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      async _listFactors(params) {
        (0, helpers_1.validateUUID)(params.userId);
        try {
          const { data, error } = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/users/${params.userId}/factors`, {
            headers: this.headers,
            xform: (factors) => {
              return { data: { factors }, error: null };
            }
          });
          return { data, error };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      async _deleteFactor(params) {
        (0, helpers_1.validateUUID)(params.userId);
        (0, helpers_1.validateUUID)(params.id);
        try {
          const data = await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/admin/users/${params.userId}/factors/${params.id}`, {
            headers: this.headers
          });
          return { data, error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Lists all OAuth clients with optional pagination.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _listOAuthClients(params) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
          const pagination = { nextPage: null, lastPage: 0, total: 0 };
          const response = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/oauth/clients`, {
            headers: this.headers,
            noResolveJson: true,
            query: {
              page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
              per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
            },
            xform: fetch_1._noResolveJsonResponse
          });
          if (response.error)
            throw response.error;
          const clients = await response.json();
          const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
          const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
          if (links.length > 0) {
            links.forEach((link) => {
              const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
              const rel = JSON.parse(link.split(";")[1].split("=")[1]);
              pagination[`${rel}Page`] = page;
            });
            pagination.total = parseInt(total);
          }
          return { data: Object.assign(Object.assign({}, clients), pagination), error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { clients: [] }, error };
          }
          throw error;
        }
      }
      /**
       * Creates a new OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _createOAuthClient(params) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/oauth/clients`, {
            body: params,
            headers: this.headers,
            xform: (client) => {
              return { data: client, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Gets details of a specific OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _getOAuthClient(clientId) {
        try {
          return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/oauth/clients/${clientId}`, {
            headers: this.headers,
            xform: (client) => {
              return { data: client, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Updates an existing OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _updateOAuthClient(clientId, params) {
        try {
          return await (0, fetch_1._request)(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${clientId}`, {
            body: params,
            headers: this.headers,
            xform: (client) => {
              return { data: client, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Deletes an OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _deleteOAuthClient(clientId) {
        try {
          await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${clientId}`, {
            headers: this.headers,
            noResolveJson: true
          });
          return { data: null, error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Regenerates the secret for an OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _regenerateOAuthClientSecret(clientId) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/oauth/clients/${clientId}/regenerate_secret`, {
            headers: this.headers,
            xform: (client) => {
              return { data: client, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Lists all custom providers with optional type filter.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _listCustomProviders(params) {
        try {
          const query = {};
          if (params === null || params === void 0 ? void 0 : params.type) {
            query.type = params.type;
          }
          return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/custom-providers`, {
            headers: this.headers,
            query,
            xform: (data) => {
              var _a;
              return { data: { providers: (_a = data === null || data === void 0 ? void 0 : data.providers) !== null && _a !== void 0 ? _a : [] }, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { providers: [] }, error };
          }
          throw error;
        }
      }
      /**
       * Creates a new custom OIDC/OAuth provider.
       *
       * For OIDC providers, the server fetches and validates the OpenID Connect discovery document
       * from the issuer's well-known endpoint (or the provided `discovery_url`) at creation time.
       * This may return a validation error (`error_code: "validation_failed"`) if the discovery
       * document is unreachable, not valid JSON, missing required fields, or if the issuer
       * in the document does not match the expected issuer.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _createCustomProvider(params) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/custom-providers`, {
            body: params,
            headers: this.headers,
            xform: (provider) => {
              return { data: provider, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Gets details of a specific custom provider by identifier.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _getCustomProvider(identifier) {
        try {
          return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/custom-providers/${identifier}`, {
            headers: this.headers,
            xform: (provider) => {
              return { data: provider, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Updates an existing custom provider.
       *
       * When `issuer` or `discovery_url` is changed on an OIDC provider, the server re-fetches and
       * validates the discovery document before persisting. This may return a validation error
       * (`error_code: "validation_failed"`) if the discovery document is unreachable, invalid, or
       * the issuer does not match.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _updateCustomProvider(identifier, params) {
        try {
          return await (0, fetch_1._request)(this.fetch, "PUT", `${this.url}/admin/custom-providers/${identifier}`, {
            body: params,
            headers: this.headers,
            xform: (provider) => {
              return { data: provider, error: null };
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Deletes a custom provider.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _deleteCustomProvider(identifier) {
        try {
          await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/admin/custom-providers/${identifier}`, {
            headers: this.headers,
            noResolveJson: true
          });
          return { data: null, error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
    };
    exports.default = GoTrueAdminApi;
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/local-storage.js
var require_local_storage = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/local-storage.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.memoryLocalStorageAdapter = memoryLocalStorageAdapter;
    function memoryLocalStorageAdapter(store = {}) {
      return {
        getItem: (key) => {
          return store[key] || null;
        },
        setItem: (key, value) => {
          store[key] = value;
        },
        removeItem: (key) => {
          delete store[key];
        }
      };
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/locks.js
var require_locks = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/locks.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProcessLockAcquireTimeoutError = exports.NavigatorLockAcquireTimeoutError = exports.LockAcquireTimeoutError = exports.internals = void 0;
    exports.navigatorLock = navigatorLock;
    exports.processLock = processLock2;
    var helpers_1 = require_helpers();
    exports.internals = {
      /**
       * @experimental
       */
      debug: !!(globalThis && (0, helpers_1.supportsLocalStorage)() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug") === "true")
    };
    var LockAcquireTimeoutError = class extends Error {
      constructor(message) {
        super(message);
        this.isAcquireTimeout = true;
      }
    };
    exports.LockAcquireTimeoutError = LockAcquireTimeoutError;
    var NavigatorLockAcquireTimeoutError = class extends LockAcquireTimeoutError {
    };
    exports.NavigatorLockAcquireTimeoutError = NavigatorLockAcquireTimeoutError;
    var ProcessLockAcquireTimeoutError = class extends LockAcquireTimeoutError {
    };
    exports.ProcessLockAcquireTimeoutError = ProcessLockAcquireTimeoutError;
    async function navigatorLock(name, acquireTimeout, fn) {
      if (exports.internals.debug) {
        console.log("@supabase/gotrue-js: navigatorLock: acquire lock", name, acquireTimeout);
      }
      const abortController = new globalThis.AbortController();
      if (acquireTimeout > 0) {
        setTimeout(() => {
          abortController.abort();
          if (exports.internals.debug) {
            console.log("@supabase/gotrue-js: navigatorLock acquire timed out", name);
          }
        }, acquireTimeout);
      }
      await Promise.resolve();
      try {
        return await globalThis.navigator.locks.request(name, acquireTimeout === 0 ? {
          mode: "exclusive",
          ifAvailable: true
        } : {
          mode: "exclusive",
          signal: abortController.signal
        }, async (lock) => {
          if (lock) {
            if (exports.internals.debug) {
              console.log("@supabase/gotrue-js: navigatorLock: acquired", name, lock.name);
            }
            try {
              return await fn();
            } finally {
              if (exports.internals.debug) {
                console.log("@supabase/gotrue-js: navigatorLock: released", name, lock.name);
              }
            }
          } else {
            if (acquireTimeout === 0) {
              if (exports.internals.debug) {
                console.log("@supabase/gotrue-js: navigatorLock: not immediately available", name);
              }
              throw new NavigatorLockAcquireTimeoutError(`Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`);
            } else {
              if (exports.internals.debug) {
                try {
                  const result = await globalThis.navigator.locks.query();
                  console.log("@supabase/gotrue-js: Navigator LockManager state", JSON.stringify(result, null, "  "));
                } catch (e) {
                  console.warn("@supabase/gotrue-js: Error when querying Navigator LockManager state", e);
                }
              }
              console.warn("@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request");
              return await fn();
            }
          }
        });
      } catch (e) {
        if ((e === null || e === void 0 ? void 0 : e.name) === "AbortError" && acquireTimeout > 0) {
          if (exports.internals.debug) {
            console.log("@supabase/gotrue-js: navigatorLock: acquire timeout, recovering by stealing lock", name);
          }
          console.warn(`@supabase/gotrue-js: Lock "${name}" was not released within ${acquireTimeout}ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). Forcefully acquiring the lock to recover.`);
          return await Promise.resolve().then(() => globalThis.navigator.locks.request(name, {
            mode: "exclusive",
            steal: true
          }, async (lock) => {
            if (lock) {
              if (exports.internals.debug) {
                console.log("@supabase/gotrue-js: navigatorLock: recovered (stolen)", name, lock.name);
              }
              try {
                return await fn();
              } finally {
                if (exports.internals.debug) {
                  console.log("@supabase/gotrue-js: navigatorLock: released (stolen)", name, lock.name);
                }
              }
            } else {
              console.warn("@supabase/gotrue-js: Navigator LockManager returned null lock even with steal: true");
              return await fn();
            }
          }));
        }
        throw e;
      }
    }
    var PROCESS_LOCKS = {};
    async function processLock2(name, acquireTimeout, fn) {
      var _a;
      const previousOperation = (_a = PROCESS_LOCKS[name]) !== null && _a !== void 0 ? _a : Promise.resolve();
      const previousOperationHandled = (async () => {
        try {
          await previousOperation;
          return null;
        } catch (e) {
          return null;
        }
      })();
      const currentOperation = (async () => {
        let timeoutId = null;
        try {
          const timeoutPromise = acquireTimeout >= 0 ? new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              console.warn(`@supabase/gotrue-js: Lock "${name}" acquisition timed out after ${acquireTimeout}ms. This may be caused by another operation holding the lock. Consider increasing lockAcquireTimeout or checking for stuck operations.`);
              reject(new ProcessLockAcquireTimeoutError(`Acquiring process lock with name "${name}" timed out`));
            }, acquireTimeout);
          }) : null;
          await Promise.race([previousOperationHandled, timeoutPromise].filter((x) => x));
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
        } catch (e) {
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
          if (e && e.isAcquireTimeout) {
            throw e;
          }
        }
        return await fn();
      })();
      PROCESS_LOCKS[name] = (async () => {
        try {
          return await currentOperation;
        } catch (e) {
          if (e && e.isAcquireTimeout) {
            try {
              await previousOperation;
            } catch (prevError) {
            }
            return null;
          }
          throw e;
        }
      })();
      return await currentOperation;
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/polyfills.js
var require_polyfills = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/polyfills.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.polyfillGlobalThis = polyfillGlobalThis;
    function polyfillGlobalThis() {
      if (typeof globalThis === "object")
        return;
      try {
        Object.defineProperty(Object.prototype, "__magic__", {
          get: function() {
            return this;
          },
          configurable: true
        });
        __magic__.globalThis = __magic__;
        delete Object.prototype.__magic__;
      } catch (e) {
        if (typeof self !== "undefined") {
          self.globalThis = self;
        }
      }
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/web3/ethereum.js
var require_ethereum = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/web3/ethereum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getAddress = getAddress;
    exports.fromHex = fromHex;
    exports.toHex = toHex;
    exports.createSiweMessage = createSiweMessage;
    function getAddress(address) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`@supabase/auth-js: Address "${address}" is invalid.`);
      }
      return address.toLowerCase();
    }
    function fromHex(hex) {
      return parseInt(hex, 16);
    }
    function toHex(value) {
      const bytes = new TextEncoder().encode(value);
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return "0x" + hex;
    }
    function createSiweMessage(parameters) {
      var _a;
      const { chainId, domain, expirationTime, issuedAt = /* @__PURE__ */ new Date(), nonce, notBefore, requestId, resources, scheme, uri, version: version3 } = parameters;
      {
        if (!Number.isInteger(chainId))
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${chainId}`);
        if (!domain)
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);
        if (nonce && nonce.length < 8)
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${nonce}`);
        if (!uri)
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);
        if (version3 !== "1")
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${version3}`);
        if ((_a = parameters.statement) === null || _a === void 0 ? void 0 : _a.includes("\n"))
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${parameters.statement}`);
      }
      const address = getAddress(parameters.address);
      const origin = scheme ? `${scheme}://${domain}` : domain;
      const statement = parameters.statement ? `${parameters.statement}
` : "";
      const prefix = `${origin} wants you to sign in with your Ethereum account:
${address}

${statement}`;
      let suffix = `URI: ${uri}
Version: ${version3}
Chain ID: ${chainId}${nonce ? `
Nonce: ${nonce}` : ""}
Issued At: ${issuedAt.toISOString()}`;
      if (expirationTime)
        suffix += `
Expiration Time: ${expirationTime.toISOString()}`;
      if (notBefore)
        suffix += `
Not Before: ${notBefore.toISOString()}`;
      if (requestId)
        suffix += `
Request ID: ${requestId}`;
      if (resources) {
        let content = "\nResources:";
        for (const resource of resources) {
          if (!resource || typeof resource !== "string")
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${resource}`);
          content += `
- ${resource}`;
        }
        suffix += content;
      }
      return `${prefix}
${suffix}`;
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/webauthn.errors.js
var require_webauthn_errors = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/webauthn.errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebAuthnUnknownError = exports.WebAuthnError = void 0;
    exports.isWebAuthnError = isWebAuthnError;
    exports.identifyRegistrationError = identifyRegistrationError;
    exports.identifyAuthenticationError = identifyAuthenticationError;
    var webauthn_1 = require_webauthn();
    var WebAuthnError = class extends Error {
      constructor({ message, code, cause, name }) {
        var _a;
        super(message, { cause });
        this.__isWebAuthnError = true;
        this.name = (_a = name !== null && name !== void 0 ? name : cause instanceof Error ? cause.name : void 0) !== null && _a !== void 0 ? _a : "Unknown Error";
        this.code = code;
      }
    };
    exports.WebAuthnError = WebAuthnError;
    var WebAuthnUnknownError = class extends WebAuthnError {
      constructor(message, originalError) {
        super({
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: originalError,
          message
        });
        this.name = "WebAuthnUnknownError";
        this.originalError = originalError;
      }
    };
    exports.WebAuthnUnknownError = WebAuthnUnknownError;
    function isWebAuthnError(error) {
      return typeof error === "object" && error !== null && "__isWebAuthnError" in error;
    }
    function identifyRegistrationError({ error, options }) {
      var _a, _b, _c;
      const { publicKey } = options;
      if (!publicKey) {
        throw Error("options was missing required publicKey property");
      }
      if (error.name === "AbortError") {
        if (options.signal instanceof AbortSignal) {
          return new WebAuthnError({
            message: "Registration ceremony was sent an abort signal",
            code: "ERROR_CEREMONY_ABORTED",
            cause: error
          });
        }
      } else if (error.name === "ConstraintError") {
        if (((_a = publicKey.authenticatorSelection) === null || _a === void 0 ? void 0 : _a.requireResidentKey) === true) {
          return new WebAuthnError({
            message: "Discoverable credentials were required but no available authenticator supported it",
            code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
            cause: error
          });
        } else if (
          // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
          options.mediation === "conditional" && ((_b = publicKey.authenticatorSelection) === null || _b === void 0 ? void 0 : _b.userVerification) === "required"
        ) {
          return new WebAuthnError({
            message: "User verification was required during automatic registration but it could not be performed",
            code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
            cause: error
          });
        } else if (((_c = publicKey.authenticatorSelection) === null || _c === void 0 ? void 0 : _c.userVerification) === "required") {
          return new WebAuthnError({
            message: "User verification was required but no available authenticator supported it",
            code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
            cause: error
          });
        }
      } else if (error.name === "InvalidStateError") {
        return new WebAuthnError({
          message: "The authenticator was previously registered",
          code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
          cause: error
        });
      } else if (error.name === "NotAllowedError") {
        return new WebAuthnError({
          message: error.message,
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: error
        });
      } else if (error.name === "NotSupportedError") {
        const validPubKeyCredParams = publicKey.pubKeyCredParams.filter((param) => param.type === "public-key");
        if (validPubKeyCredParams.length === 0) {
          return new WebAuthnError({
            message: 'No entry in pubKeyCredParams was of type "public-key"',
            code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
            cause: error
          });
        }
        return new WebAuthnError({
          message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
          code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
          cause: error
        });
      } else if (error.name === "SecurityError") {
        const effectiveDomain = window.location.hostname;
        if (!(0, webauthn_1.isValidDomain)(effectiveDomain)) {
          return new WebAuthnError({
            message: `${window.location.hostname} is an invalid domain`,
            code: "ERROR_INVALID_DOMAIN",
            cause: error
          });
        } else if (publicKey.rp.id !== effectiveDomain) {
          return new WebAuthnError({
            message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: error
          });
        }
      } else if (error.name === "TypeError") {
        if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
          return new WebAuthnError({
            message: "User ID was not between 1 and 64 characters",
            code: "ERROR_INVALID_USER_ID_LENGTH",
            cause: error
          });
        }
      } else if (error.name === "UnknownError") {
        return new WebAuthnError({
          message: "The authenticator was unable to process the specified options, or could not create a new credential",
          code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
          cause: error
        });
      }
      return new WebAuthnError({
        message: "a Non-Webauthn related error has occurred",
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: error
      });
    }
    function identifyAuthenticationError({ error, options }) {
      const { publicKey } = options;
      if (!publicKey) {
        throw Error("options was missing required publicKey property");
      }
      if (error.name === "AbortError") {
        if (options.signal instanceof AbortSignal) {
          return new WebAuthnError({
            message: "Authentication ceremony was sent an abort signal",
            code: "ERROR_CEREMONY_ABORTED",
            cause: error
          });
        }
      } else if (error.name === "NotAllowedError") {
        return new WebAuthnError({
          message: error.message,
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: error
        });
      } else if (error.name === "SecurityError") {
        const effectiveDomain = window.location.hostname;
        if (!(0, webauthn_1.isValidDomain)(effectiveDomain)) {
          return new WebAuthnError({
            message: `${window.location.hostname} is an invalid domain`,
            code: "ERROR_INVALID_DOMAIN",
            cause: error
          });
        } else if (publicKey.rpId !== effectiveDomain) {
          return new WebAuthnError({
            message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: error
          });
        }
      } else if (error.name === "UnknownError") {
        return new WebAuthnError({
          message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
          code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
          cause: error
        });
      }
      return new WebAuthnError({
        message: "a Non-Webauthn related error has occurred",
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: error
      });
    }
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/webauthn.js
var require_webauthn = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/webauthn.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebAuthnApi = exports.DEFAULT_REQUEST_OPTIONS = exports.DEFAULT_CREATION_OPTIONS = exports.webAuthnAbortService = exports.WebAuthnAbortService = exports.identifyAuthenticationError = exports.identifyRegistrationError = exports.isWebAuthnError = exports.WebAuthnError = void 0;
    exports.deserializeCredentialCreationOptions = deserializeCredentialCreationOptions;
    exports.deserializeCredentialRequestOptions = deserializeCredentialRequestOptions;
    exports.serializeCredentialCreationResponse = serializeCredentialCreationResponse;
    exports.serializeCredentialRequestResponse = serializeCredentialRequestResponse;
    exports.isValidDomain = isValidDomain;
    exports.createCredential = createCredential;
    exports.getCredential = getCredential;
    exports.mergeCredentialCreationOptions = mergeCredentialCreationOptions;
    exports.mergeCredentialRequestOptions = mergeCredentialRequestOptions;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var base64url_1 = require_base64url();
    var errors_1 = require_errors();
    var helpers_1 = require_helpers();
    var webauthn_errors_1 = require_webauthn_errors();
    Object.defineProperty(exports, "identifyAuthenticationError", { enumerable: true, get: function() {
      return webauthn_errors_1.identifyAuthenticationError;
    } });
    Object.defineProperty(exports, "identifyRegistrationError", { enumerable: true, get: function() {
      return webauthn_errors_1.identifyRegistrationError;
    } });
    Object.defineProperty(exports, "isWebAuthnError", { enumerable: true, get: function() {
      return webauthn_errors_1.isWebAuthnError;
    } });
    Object.defineProperty(exports, "WebAuthnError", { enumerable: true, get: function() {
      return webauthn_errors_1.WebAuthnError;
    } });
    var WebAuthnAbortService = class {
      /**
       * Create an abort signal for a new WebAuthn operation.
       * Automatically cancels any existing operation.
       *
       * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
       */
      createNewAbortSignal() {
        if (this.controller) {
          const abortError = new Error("Cancelling existing WebAuthn API call for new one");
          abortError.name = "AbortError";
          this.controller.abort(abortError);
        }
        const newController = new AbortController();
        this.controller = newController;
        return newController.signal;
      }
      /**
       * Manually cancel the current WebAuthn operation.
       * Useful for cleaning up when user cancels or navigates away.
       *
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
       */
      cancelCeremony() {
        if (this.controller) {
          const abortError = new Error("Manually cancelling existing WebAuthn API call");
          abortError.name = "AbortError";
          this.controller.abort(abortError);
          this.controller = void 0;
        }
      }
    };
    exports.WebAuthnAbortService = WebAuthnAbortService;
    exports.webAuthnAbortService = new WebAuthnAbortService();
    function deserializeCredentialCreationOptions(options) {
      if (!options) {
        throw new Error("Credential creation options are required");
      }
      if (typeof PublicKeyCredential !== "undefined" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function") {
        return PublicKeyCredential.parseCreationOptionsFromJSON(
          /** we assert the options here as typescript still doesn't know about future webauthn types */
          options
        );
      }
      const { challenge: challengeStr, user: userOpts, excludeCredentials } = options, restOptions = tslib_1.__rest(
        options,
        ["challenge", "user", "excludeCredentials"]
      );
      const challenge = (0, base64url_1.base64UrlToUint8Array)(challengeStr).buffer;
      const user = Object.assign(Object.assign({}, userOpts), { id: (0, base64url_1.base64UrlToUint8Array)(userOpts.id).buffer });
      const result = Object.assign(Object.assign({}, restOptions), {
        challenge,
        user
      });
      if (excludeCredentials && excludeCredentials.length > 0) {
        result.excludeCredentials = new Array(excludeCredentials.length);
        for (let i = 0; i < excludeCredentials.length; i++) {
          const cred = excludeCredentials[i];
          result.excludeCredentials[i] = Object.assign(Object.assign({}, cred), {
            id: (0, base64url_1.base64UrlToUint8Array)(cred.id).buffer,
            type: cred.type || "public-key",
            // Cast transports to handle future transport types like "cable"
            transports: cred.transports
          });
        }
      }
      return result;
    }
    function deserializeCredentialRequestOptions(options) {
      if (!options) {
        throw new Error("Credential request options are required");
      }
      if (typeof PublicKeyCredential !== "undefined" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function") {
        return PublicKeyCredential.parseRequestOptionsFromJSON(options);
      }
      const { challenge: challengeStr, allowCredentials } = options, restOptions = tslib_1.__rest(
        options,
        ["challenge", "allowCredentials"]
      );
      const challenge = (0, base64url_1.base64UrlToUint8Array)(challengeStr).buffer;
      const result = Object.assign(Object.assign({}, restOptions), { challenge });
      if (allowCredentials && allowCredentials.length > 0) {
        result.allowCredentials = new Array(allowCredentials.length);
        for (let i = 0; i < allowCredentials.length; i++) {
          const cred = allowCredentials[i];
          result.allowCredentials[i] = Object.assign(Object.assign({}, cred), {
            id: (0, base64url_1.base64UrlToUint8Array)(cred.id).buffer,
            type: cred.type || "public-key",
            // Cast transports to handle future transport types like "cable"
            transports: cred.transports
          });
        }
      }
      return result;
    }
    function serializeCredentialCreationResponse(credential) {
      var _a;
      if ("toJSON" in credential && typeof credential.toJSON === "function") {
        return credential.toJSON();
      }
      const credentialWithAttachment = credential;
      return {
        id: credential.id,
        rawId: credential.id,
        response: {
          attestationObject: (0, base64url_1.bytesToBase64URL)(new Uint8Array(credential.response.attestationObject)),
          clientDataJSON: (0, base64url_1.bytesToBase64URL)(new Uint8Array(credential.response.clientDataJSON))
        },
        type: "public-key",
        clientExtensionResults: credential.getClientExtensionResults(),
        // Convert null to undefined and cast to AuthenticatorAttachment type
        authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
      };
    }
    function serializeCredentialRequestResponse(credential) {
      var _a;
      if ("toJSON" in credential && typeof credential.toJSON === "function") {
        return credential.toJSON();
      }
      const credentialWithAttachment = credential;
      const clientExtensionResults = credential.getClientExtensionResults();
      const assertionResponse = credential.response;
      return {
        id: credential.id,
        rawId: credential.id,
        // W3C spec expects rawId to match id for JSON format
        response: {
          authenticatorData: (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.authenticatorData)),
          clientDataJSON: (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.clientDataJSON)),
          signature: (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.signature)),
          userHandle: assertionResponse.userHandle ? (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.userHandle)) : void 0
        },
        type: "public-key",
        clientExtensionResults,
        // Convert null to undefined and cast to AuthenticatorAttachment type
        authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
      };
    }
    function isValidDomain(hostname) {
      return (
        // Consider localhost valid as well since it's okay wrt Secure Contexts
        hostname === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(hostname)
      );
    }
    function browserSupportsWebAuthn() {
      var _a, _b;
      return !!((0, helpers_1.isBrowser)() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof ((_a = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _a === void 0 ? void 0 : _a.create) === "function" && typeof ((_b = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _b === void 0 ? void 0 : _b.get) === "function");
    }
    async function createCredential(options) {
      try {
        const response = await navigator.credentials.create(
          /** we assert the type here until typescript types are updated */
          options
        );
        if (!response) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Empty credential response", response)
          };
        }
        if (!(response instanceof PublicKeyCredential)) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Browser returned unexpected credential type", response)
          };
        }
        return { data: response, error: null };
      } catch (err) {
        return {
          data: null,
          error: (0, webauthn_errors_1.identifyRegistrationError)({
            error: err,
            options
          })
        };
      }
    }
    async function getCredential(options) {
      try {
        const response = await navigator.credentials.get(
          /** we assert the type here until typescript types are updated */
          options
        );
        if (!response) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Empty credential response", response)
          };
        }
        if (!(response instanceof PublicKeyCredential)) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Browser returned unexpected credential type", response)
          };
        }
        return { data: response, error: null };
      } catch (err) {
        return {
          data: null,
          error: (0, webauthn_errors_1.identifyAuthenticationError)({
            error: err,
            options
          })
        };
      }
    }
    exports.DEFAULT_CREATION_OPTIONS = {
      hints: ["security-key"],
      authenticatorSelection: {
        authenticatorAttachment: "cross-platform",
        requireResidentKey: false,
        /** set to preferred because older yubikeys don't have PIN/Biometric */
        userVerification: "preferred",
        residentKey: "discouraged"
      },
      attestation: "direct"
    };
    exports.DEFAULT_REQUEST_OPTIONS = {
      /** set to preferred because older yubikeys don't have PIN/Biometric */
      userVerification: "preferred",
      hints: ["security-key"],
      attestation: "direct"
    };
    function deepMerge(...sources) {
      const isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
      const isArrayBufferLike = (val) => val instanceof ArrayBuffer || ArrayBuffer.isView(val);
      const result = {};
      for (const source of sources) {
        if (!source)
          continue;
        for (const key in source) {
          const value = source[key];
          if (value === void 0)
            continue;
          if (Array.isArray(value)) {
            result[key] = value;
          } else if (isArrayBufferLike(value)) {
            result[key] = value;
          } else if (isObject(value)) {
            const existing = result[key];
            if (isObject(existing)) {
              result[key] = deepMerge(existing, value);
            } else {
              result[key] = deepMerge(value);
            }
          } else {
            result[key] = value;
          }
        }
      }
      return result;
    }
    function mergeCredentialCreationOptions(baseOptions, overrides) {
      return deepMerge(exports.DEFAULT_CREATION_OPTIONS, baseOptions, overrides || {});
    }
    function mergeCredentialRequestOptions(baseOptions, overrides) {
      return deepMerge(exports.DEFAULT_REQUEST_OPTIONS, baseOptions, overrides || {});
    }
    var WebAuthnApi = class {
      constructor(client) {
        this.client = client;
        this.enroll = this._enroll.bind(this);
        this.challenge = this._challenge.bind(this);
        this.verify = this._verify.bind(this);
        this.authenticate = this._authenticate.bind(this);
        this.register = this._register.bind(this);
      }
      /**
       * Enroll a new WebAuthn factor.
       * Creates an unverified WebAuthn factor that must be verified with a credential.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
       * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
       * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
       */
      async _enroll(params) {
        return this.client.mfa.enroll(Object.assign(Object.assign({}, params), { factorType: "webauthn" }));
      }
      /**
       * Challenge for WebAuthn credential creation or authentication.
       * Combines server challenge with browser credential operations.
       * Handles both registration (create) and authentication (request) flows.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
       * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
       * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
       * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
       * @returns {Promise<RequestResult>} Challenge response with credential or error
       * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
       * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
       */
      async _challenge({ factorId, webauthn, friendlyName, signal }, overrides) {
        var _a;
        try {
          const { data: challengeResponse, error: challengeError } = await this.client.mfa.challenge({
            factorId,
            webauthn
          });
          if (!challengeResponse) {
            return { data: null, error: challengeError };
          }
          const abortSignal = signal !== null && signal !== void 0 ? signal : exports.webAuthnAbortService.createNewAbortSignal();
          if (challengeResponse.webauthn.type === "create") {
            const { user } = challengeResponse.webauthn.credential_options.publicKey;
            if (!user.name) {
              const nameToUse = friendlyName;
              if (!nameToUse) {
                const currentUser = await this.client.getUser();
                const userData = currentUser.data.user;
                const fallbackName = ((_a = userData === null || userData === void 0 ? void 0 : userData.user_metadata) === null || _a === void 0 ? void 0 : _a.name) || (userData === null || userData === void 0 ? void 0 : userData.email) || (userData === null || userData === void 0 ? void 0 : userData.id) || "User";
                user.name = `${user.id}:${fallbackName}`;
              } else {
                user.name = `${user.id}:${nameToUse}`;
              }
            }
            if (!user.displayName) {
              user.displayName = user.name;
            }
          }
          switch (challengeResponse.webauthn.type) {
            case "create": {
              const options = mergeCredentialCreationOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.create);
              const { data, error } = await createCredential({
                publicKey: options,
                signal: abortSignal
              });
              if (data) {
                return {
                  data: {
                    factorId,
                    challengeId: challengeResponse.id,
                    webauthn: {
                      type: challengeResponse.webauthn.type,
                      credential_response: data
                    }
                  },
                  error: null
                };
              }
              return { data: null, error };
            }
            case "request": {
              const options = mergeCredentialRequestOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.request);
              const { data, error } = await getCredential(Object.assign(Object.assign({}, challengeResponse.webauthn.credential_options), { publicKey: options, signal: abortSignal }));
              if (data) {
                return {
                  data: {
                    factorId,
                    challengeId: challengeResponse.id,
                    webauthn: {
                      type: challengeResponse.webauthn.type,
                      credential_response: data
                    }
                  },
                  error: null
                };
              }
              return { data: null, error };
            }
          }
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          return {
            data: null,
            error: new errors_1.AuthUnknownError("Unexpected error in challenge", error)
          };
        }
      }
      /**
       * Verify a WebAuthn credential with the server.
       * Completes the WebAuthn ceremony by sending the credential to the server for verification.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Object} params - Verification parameters
       * @param {string} params.challengeId - ID of the challenge being verified
       * @param {string} params.factorId - ID of the WebAuthn factor
       * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
       * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
       * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
       * */
      async _verify({ challengeId, factorId, webauthn }) {
        return this.client.mfa.verify({
          factorId,
          challengeId,
          webauthn
        });
      }
      /**
       * Complete WebAuthn authentication flow.
       * Performs challenge and verification in a single operation for existing credentials.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Object} params - Authentication parameters
       * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
       * @param {Object} params.webauthn - WebAuthn configuration
       * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
       * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
       * @param {AbortSignal} params.webauthn.signal - Optional abort signal
       * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
       * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
       * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
       */
      async _authenticate({ factorId, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
        if (!rpId) {
          return {
            data: null,
            error: new errors_1.AuthError("rpId is required for WebAuthn authentication")
          };
        }
        try {
          if (!browserSupportsWebAuthn()) {
            return {
              data: null,
              error: new errors_1.AuthUnknownError("Browser does not support WebAuthn", null)
            };
          }
          const { data: challengeResponse, error: challengeError } = await this.challenge({
            factorId,
            webauthn: { rpId, rpOrigins },
            signal
          }, { request: overrides });
          if (!challengeResponse) {
            return { data: null, error: challengeError };
          }
          const { webauthn } = challengeResponse;
          return this._verify({
            factorId,
            challengeId: challengeResponse.challengeId,
            webauthn: {
              type: webauthn.type,
              rpId,
              rpOrigins,
              credential_response: webauthn.credential_response
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          return {
            data: null,
            error: new errors_1.AuthUnknownError("Unexpected error in authenticate", error)
          };
        }
      }
      /**
       * Complete WebAuthn registration flow.
       * Performs enrollment, challenge, and verification in a single operation for new credentials.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Object} params - Registration parameters
       * @param {string} params.friendlyName - User-friendly name for the credential
       * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
       * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
       * @param {AbortSignal} params.signal - Optional abort signal
       * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
       * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
       * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
       */
      async _register({ friendlyName, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
        if (!rpId) {
          return {
            data: null,
            error: new errors_1.AuthError("rpId is required for WebAuthn registration")
          };
        }
        try {
          if (!browserSupportsWebAuthn()) {
            return {
              data: null,
              error: new errors_1.AuthUnknownError("Browser does not support WebAuthn", null)
            };
          }
          const { data: factor, error: enrollError } = await this._enroll({
            friendlyName
          });
          if (!factor) {
            await this.client.mfa.listFactors().then((factors) => {
              var _a;
              return (_a = factors.data) === null || _a === void 0 ? void 0 : _a.all.find((v) => v.factor_type === "webauthn" && v.friendly_name === friendlyName && v.status !== "unverified");
            }).then((factor2) => factor2 ? this.client.mfa.unenroll({ factorId: factor2 === null || factor2 === void 0 ? void 0 : factor2.id }) : void 0);
            return { data: null, error: enrollError };
          }
          const { data: challengeResponse, error: challengeError } = await this._challenge({
            factorId: factor.id,
            friendlyName: factor.friendly_name,
            webauthn: { rpId, rpOrigins },
            signal
          }, {
            create: overrides
          });
          if (!challengeResponse) {
            return { data: null, error: challengeError };
          }
          return this._verify({
            factorId: factor.id,
            challengeId: challengeResponse.challengeId,
            webauthn: {
              rpId,
              rpOrigins,
              type: challengeResponse.webauthn.type,
              credential_response: challengeResponse.webauthn.credential_response
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          return {
            data: null,
            error: new errors_1.AuthUnknownError("Unexpected error in register", error)
          };
        }
      }
    };
    exports.WebAuthnApi = WebAuthnApi;
  }
});

// node_modules/@supabase/auth-js/dist/main/GoTrueClient.js
var require_GoTrueClient = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/GoTrueClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueAdminApi_1 = tslib_1.__importDefault(require_GoTrueAdminApi());
    var constants_1 = require_constants2();
    var errors_1 = require_errors();
    var fetch_1 = require_fetch();
    var helpers_1 = require_helpers();
    var local_storage_1 = require_local_storage();
    var locks_1 = require_locks();
    var polyfills_1 = require_polyfills();
    var version_1 = require_version2();
    var base64url_1 = require_base64url();
    var ethereum_1 = require_ethereum();
    var webauthn_1 = require_webauthn();
    (0, polyfills_1.polyfillGlobalThis)();
    var DEFAULT_OPTIONS = {
      url: constants_1.GOTRUE_URL,
      storageKey: constants_1.STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      headers: constants_1.DEFAULT_HEADERS,
      flowType: "implicit",
      debug: false,
      hasCustomAuthorizationHeader: false,
      throwOnError: false,
      lockAcquireTimeout: 5e3,
      // 5 seconds
      skipAutoInitialize: false
    };
    async function lockNoOp(name, acquireTimeout, fn) {
      return await fn();
    }
    var GLOBAL_JWKS = {};
    var GoTrueClient = class _GoTrueClient {
      /**
       * The JWKS used for verifying asymmetric JWTs
       */
      get jwks() {
        var _a, _b;
        return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.jwks) !== null && _b !== void 0 ? _b : { keys: [] };
      }
      set jwks(value) {
        GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { jwks: value });
      }
      get jwks_cached_at() {
        var _a, _b;
        return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.cachedAt) !== null && _b !== void 0 ? _b : Number.MIN_SAFE_INTEGER;
      }
      set jwks_cached_at(value) {
        GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { cachedAt: value });
      }
      /**
       * Create a new client for use in the browser.
       *
       * @example
       * ```ts
       * import { GoTrueClient } from '@supabase/auth-js'
       *
       * const auth = new GoTrueClient({
       *   url: 'https://xyzcompany.supabase.co/auth/v1',
       *   headers: { apikey: 'public-anon-key' },
       *   storageKey: 'supabase-auth',
       * })
       * ```
       */
      constructor(options) {
        var _a, _b, _c;
        this.userStorage = null;
        this.memoryStorage = null;
        this.stateChangeEmitters = /* @__PURE__ */ new Map();
        this.autoRefreshTicker = null;
        this.autoRefreshTickTimeout = null;
        this.visibilityChangedCallback = null;
        this.refreshingDeferred = null;
        this.initializePromise = null;
        this.detectSessionInUrl = true;
        this.hasCustomAuthorizationHeader = false;
        this.suppressGetSessionWarning = false;
        this.lockAcquired = false;
        this.pendingInLock = [];
        this.broadcastChannel = null;
        this.logger = console.log;
        const settings = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
        this.storageKey = settings.storageKey;
        this.instanceID = (_a = _GoTrueClient.nextInstanceID[this.storageKey]) !== null && _a !== void 0 ? _a : 0;
        _GoTrueClient.nextInstanceID[this.storageKey] = this.instanceID + 1;
        this.logDebugMessages = !!settings.debug;
        if (typeof settings.debug === "function") {
          this.logger = settings.debug;
        }
        if (this.instanceID > 0 && (0, helpers_1.isBrowser)()) {
          const message = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
          console.warn(message);
          if (this.logDebugMessages) {
            console.trace(message);
          }
        }
        this.persistSession = settings.persistSession;
        this.autoRefreshToken = settings.autoRefreshToken;
        this.admin = new GoTrueAdminApi_1.default({
          url: settings.url,
          headers: settings.headers,
          fetch: settings.fetch
        });
        this.url = settings.url;
        this.headers = settings.headers;
        this.fetch = (0, helpers_1.resolveFetch)(settings.fetch);
        this.lock = settings.lock || lockNoOp;
        this.detectSessionInUrl = settings.detectSessionInUrl;
        this.flowType = settings.flowType;
        this.hasCustomAuthorizationHeader = settings.hasCustomAuthorizationHeader;
        this.throwOnError = settings.throwOnError;
        this.lockAcquireTimeout = settings.lockAcquireTimeout;
        if (settings.lock) {
          this.lock = settings.lock;
        } else if (this.persistSession && (0, helpers_1.isBrowser)() && ((_b = globalThis === null || globalThis === void 0 ? void 0 : globalThis.navigator) === null || _b === void 0 ? void 0 : _b.locks)) {
          this.lock = locks_1.navigatorLock;
        } else {
          this.lock = lockNoOp;
        }
        if (!this.jwks) {
          this.jwks = { keys: [] };
          this.jwks_cached_at = Number.MIN_SAFE_INTEGER;
        }
        this.mfa = {
          verify: this._verify.bind(this),
          enroll: this._enroll.bind(this),
          unenroll: this._unenroll.bind(this),
          challenge: this._challenge.bind(this),
          listFactors: this._listFactors.bind(this),
          challengeAndVerify: this._challengeAndVerify.bind(this),
          getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
          webauthn: new webauthn_1.WebAuthnApi(this)
        };
        this.oauth = {
          getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
          approveAuthorization: this._approveAuthorization.bind(this),
          denyAuthorization: this._denyAuthorization.bind(this),
          listGrants: this._listOAuthGrants.bind(this),
          revokeGrant: this._revokeOAuthGrant.bind(this)
        };
        if (this.persistSession) {
          if (settings.storage) {
            this.storage = settings.storage;
          } else {
            if ((0, helpers_1.supportsLocalStorage)()) {
              this.storage = globalThis.localStorage;
            } else {
              this.memoryStorage = {};
              this.storage = (0, local_storage_1.memoryLocalStorageAdapter)(this.memoryStorage);
            }
          }
          if (settings.userStorage) {
            this.userStorage = settings.userStorage;
          }
        } else {
          this.memoryStorage = {};
          this.storage = (0, local_storage_1.memoryLocalStorageAdapter)(this.memoryStorage);
        }
        if ((0, helpers_1.isBrowser)() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
          try {
            this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
          } catch (e) {
            console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", e);
          }
          (_c = this.broadcastChannel) === null || _c === void 0 ? void 0 : _c.addEventListener("message", async (event) => {
            this._debug("received broadcast notification from other tab or client", event);
            try {
              await this._notifyAllSubscribers(event.data.event, event.data.session, false);
            } catch (error) {
              this._debug("#broadcastChannel", "error", error);
            }
          });
        }
        if (!settings.skipAutoInitialize) {
          this.initialize().catch((error) => {
            this._debug("#initialize()", "error", error);
          });
        }
      }
      /**
       * Returns whether error throwing mode is enabled for this client.
       */
      isThrowOnErrorEnabled() {
        return this.throwOnError;
      }
      /**
       * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
       * and the provided result contains a non-nullish error, the error is thrown instead of
       * being returned. This ensures consistent behavior across all public API methods.
       */
      _returnResult(result) {
        if (this.throwOnError && result && result.error) {
          throw result.error;
        }
        return result;
      }
      _logPrefix() {
        return `GoTrueClient@${this.storageKey}:${this.instanceID} (${version_1.version}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
      }
      _debug(...args) {
        if (this.logDebugMessages) {
          this.logger(this._logPrefix(), ...args);
        }
        return this;
      }
      /**
       * Initializes the client session either from the url or from storage.
       * This method is automatically called when instantiating the client, but should also be called
       * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
       */
      async initialize() {
        if (this.initializePromise) {
          return await this.initializePromise;
        }
        this.initializePromise = (async () => {
          return await this._acquireLock(this.lockAcquireTimeout, async () => {
            return await this._initialize();
          });
        })();
        return await this.initializePromise;
      }
      /**
       * IMPORTANT:
       * 1. Never throw in this method, as it is called from the constructor
       * 2. Never return a session from this method as it would be cached over
       *    the whole lifetime of the client
       */
      async _initialize() {
        var _a;
        try {
          let params = {};
          let callbackUrlType = "none";
          if ((0, helpers_1.isBrowser)()) {
            params = (0, helpers_1.parseParametersFromURL)(window.location.href);
            if (this._isImplicitGrantCallback(params)) {
              callbackUrlType = "implicit";
            } else if (await this._isPKCECallback(params)) {
              callbackUrlType = "pkce";
            }
          }
          if ((0, helpers_1.isBrowser)() && this.detectSessionInUrl && callbackUrlType !== "none") {
            const { data, error } = await this._getSessionFromURL(params, callbackUrlType);
            if (error) {
              this._debug("#_initialize()", "error detecting session from URL", error);
              if ((0, errors_1.isAuthImplicitGrantRedirectError)(error)) {
                const errorCode = (_a = error.details) === null || _a === void 0 ? void 0 : _a.code;
                if (errorCode === "identity_already_exists" || errorCode === "identity_not_found" || errorCode === "single_identity_not_deletable") {
                  return { error };
                }
              }
              return { error };
            }
            const { session, redirectType } = data;
            this._debug("#_initialize()", "detected session in URL", session, "redirect type", redirectType);
            await this._saveSession(session);
            setTimeout(async () => {
              if (redirectType === "recovery") {
                await this._notifyAllSubscribers("PASSWORD_RECOVERY", session);
              } else {
                await this._notifyAllSubscribers("SIGNED_IN", session);
              }
            }, 0);
            return { error: null };
          }
          await this._recoverAndRefresh();
          return { error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ error });
          }
          return this._returnResult({
            error: new errors_1.AuthUnknownError("Unexpected error during initialization", error)
          });
        } finally {
          await this._handleVisibilityChange();
          this._debug("#_initialize()", "end");
        }
      }
      /**
       * Creates a new anonymous user.
       *
       * @returns A session where the is_anonymous claim in the access token JWT set to true
       */
      async signInAnonymously(credentials) {
        var _a, _b, _c;
        try {
          const res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/signup`, {
            headers: this.headers,
            body: {
              data: (_b = (_a = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {},
              gotrue_meta_security: { captcha_token: (_c = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _c === void 0 ? void 0 : _c.captchaToken }
            },
            xform: fetch_1._sessionResponse
          });
          const { data, error } = res;
          if (error || !data) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          const session = data.session;
          const user = data.user;
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
          return this._returnResult({ data: { user, session }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Creates a new user.
       *
       * Be aware that if a user account exists in the system you may get back an
       * error message that attempts to hide this information from the user.
       * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
       *
       * @returns A logged-in session if the server has "autoconfirm" ON
       * @returns A user if the server has "autoconfirm" OFF
       *
       * @category Auth
       *
       * @remarks
       * - By default, the user needs to verify their email address before logging in. To turn this off, disable **Confirm email** in [your project](/dashboard/project/_/auth/providers).
       * - **Confirm email** determines if users need to confirm their email address after signing up.
       *   - If **Confirm email** is enabled, a `user` is returned but `session` is null.
       *   - If **Confirm email** is disabled, both a `user` and a `session` are returned.
       * - When the user confirms their email address, they are redirected to the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) by default. You can modify your `SITE_URL` or add additional redirect URLs in [your project](/dashboard/project/_/auth/url-configuration).
       * - If signUp() is called for an existing confirmed user:
       *   - When both **Confirm email** and **Confirm phone** (even when phone provider is disabled) are enabled in [your project](/dashboard/project/_/auth/providers), an obfuscated/fake user object is returned.
       *   - When either **Confirm email** or **Confirm phone** (even when phone provider is disabled) is disabled, the error message, `User already registered` is returned.
       * - To fetch the currently logged-in user, refer to [`getUser()`](/docs/reference/javascript/auth-getuser).
       *
       * @example Sign up with an email and password
       * ```js
       * const { data, error } = await supabase.auth.signUp({
       *   email: 'example@email.com',
       *   password: 'example-password',
       * })
       * ```
       *
       * @exampleResponse Sign up with an email and password
       * ```json
       * // Some fields may be null if "confirm email" is enabled.
       * {
       *   "data": {
       *     "user": {
       *       "id": "11111111-1111-1111-1111-111111111111",
       *       "aud": "authenticated",
       *       "role": "authenticated",
       *       "email": "example@email.com",
       *       "email_confirmed_at": "2024-01-01T00:00:00Z",
       *       "phone": "",
       *       "last_sign_in_at": "2024-01-01T00:00:00Z",
       *       "app_metadata": {
       *         "provider": "email",
       *         "providers": [
       *           "email"
       *         ]
       *       },
       *       "user_metadata": {},
       *       "identities": [
       *         {
       *           "identity_id": "22222222-2222-2222-2222-222222222222",
       *           "id": "11111111-1111-1111-1111-111111111111",
       *           "user_id": "11111111-1111-1111-1111-111111111111",
       *           "identity_data": {
       *             "email": "example@email.com",
       *             "email_verified": false,
       *             "phone_verified": false,
       *             "sub": "11111111-1111-1111-1111-111111111111"
       *           },
       *           "provider": "email",
       *           "last_sign_in_at": "2024-01-01T00:00:00Z",
       *           "created_at": "2024-01-01T00:00:00Z",
       *           "updated_at": "2024-01-01T00:00:00Z",
       *           "email": "example@email.com"
       *         }
       *       ],
       *       "created_at": "2024-01-01T00:00:00Z",
       *       "updated_at": "2024-01-01T00:00:00Z"
       *     },
       *     "session": {
       *       "access_token": "<ACCESS_TOKEN>",
       *       "token_type": "bearer",
       *       "expires_in": 3600,
       *       "expires_at": 1700000000,
       *       "refresh_token": "<REFRESH_TOKEN>",
       *       "user": {
       *         "id": "11111111-1111-1111-1111-111111111111",
       *         "aud": "authenticated",
       *         "role": "authenticated",
       *         "email": "example@email.com",
       *         "email_confirmed_at": "2024-01-01T00:00:00Z",
       *         "phone": "",
       *         "last_sign_in_at": "2024-01-01T00:00:00Z",
       *         "app_metadata": {
       *           "provider": "email",
       *           "providers": [
       *             "email"
       *           ]
       *         },
       *         "user_metadata": {},
       *         "identities": [
       *           {
       *             "identity_id": "22222222-2222-2222-2222-222222222222",
       *             "id": "11111111-1111-1111-1111-111111111111",
       *             "user_id": "11111111-1111-1111-1111-111111111111",
       *             "identity_data": {
       *               "email": "example@email.com",
       *               "email_verified": false,
       *               "phone_verified": false,
       *               "sub": "11111111-1111-1111-1111-111111111111"
       *             },
       *             "provider": "email",
       *             "last_sign_in_at": "2024-01-01T00:00:00Z",
       *             "created_at": "2024-01-01T00:00:00Z",
       *             "updated_at": "2024-01-01T00:00:00Z",
       *             "email": "example@email.com"
       *           }
       *         ],
       *         "created_at": "2024-01-01T00:00:00Z",
       *         "updated_at": "2024-01-01T00:00:00Z"
       *       }
       *     }
       *   },
       *   "error": null
       * }
       * ```
       *
       * @example Sign up with a phone number and password (SMS)
       * ```js
       * const { data, error } = await supabase.auth.signUp({
       *   phone: '123456789',
       *   password: 'example-password',
       *   options: {
       *     channel: 'sms'
       *   }
       * })
       * ```
       *
       * @exampleDescription Sign up with a phone number and password (whatsapp)
       * The user will be sent a WhatsApp message which contains a OTP. By default, a given user can only request a OTP once every 60 seconds. Note that a user will need to have a valid WhatsApp account that is linked to Twilio in order to use this feature.
       *
       * @example Sign up with a phone number and password (whatsapp)
       * ```js
       * const { data, error } = await supabase.auth.signUp({
       *   phone: '123456789',
       *   password: 'example-password',
       *   options: {
       *     channel: 'whatsapp'
       *   }
       * })
       * ```
       *
       * @example Sign up with additional user metadata
       * ```js
       * const { data, error } = await supabase.auth.signUp(
       *   {
       *     email: 'example@email.com',
       *     password: 'example-password',
       *     options: {
       *       data: {
       *         first_name: 'John',
       *         age: 27,
       *       }
       *     }
       *   }
       * )
       * ```
       *
       * @exampleDescription Sign up with a redirect URL
       * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
       *
       * @example Sign up with a redirect URL
       * ```js
       * const { data, error } = await supabase.auth.signUp(
       *   {
       *     email: 'example@email.com',
       *     password: 'example-password',
       *     options: {
       *       emailRedirectTo: 'https://example.com/welcome'
       *     }
       *   }
       * )
       * ```
       */
      async signUp(credentials) {
        var _a, _b, _c;
        try {
          let res;
          if ("email" in credentials) {
            const { email, password, options } = credentials;
            let codeChallenge = null;
            let codeChallengeMethod = null;
            if (this.flowType === "pkce") {
              ;
              [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
            }
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/signup`, {
              headers: this.headers,
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
              body: {
                email,
                password,
                data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
                code_challenge: codeChallenge,
                code_challenge_method: codeChallengeMethod
              },
              xform: fetch_1._sessionResponse
            });
          } else if ("phone" in credentials) {
            const { phone, password, options } = credentials;
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/signup`, {
              headers: this.headers,
              body: {
                phone,
                password,
                data: (_b = options === null || options === void 0 ? void 0 : options.data) !== null && _b !== void 0 ? _b : {},
                channel: (_c = options === null || options === void 0 ? void 0 : options.channel) !== null && _c !== void 0 ? _c : "sms",
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponse
            });
          } else {
            throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
          }
          const { data, error } = res;
          if (error || !data) {
            await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          const session = data.session;
          const user = data.user;
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
          return this._returnResult({ data: { user, session }, error: null });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in an existing user with an email and password or phone and password.
       *
       * Be aware that you may get back an error message that will not distinguish
       * between the cases where the account does not exist or that the
       * email/phone and password combination is wrong or that the account can only
       * be accessed via social login.
       */
      async signInWithPassword(credentials) {
        try {
          let res;
          if ("email" in credentials) {
            const { email, password, options } = credentials;
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
              headers: this.headers,
              body: {
                email,
                password,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponsePassword
            });
          } else if ("phone" in credentials) {
            const { phone, password, options } = credentials;
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
              headers: this.headers,
              body: {
                phone,
                password,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponsePassword
            });
          } else {
            throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
          }
          const { data, error } = res;
          if (error) {
            return this._returnResult({ data: { user: null, session: null }, error });
          } else if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({
            data: Object.assign({ user: data.user, session: data.session }, data.weak_password ? { weakPassword: data.weak_password } : null),
            error
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in an existing user via a third-party provider.
       * This method supports the PKCE flow.
       */
      async signInWithOAuth(credentials) {
        var _a, _b, _c, _d;
        return await this._handleProviderSignIn(credentials.provider, {
          redirectTo: (_a = credentials.options) === null || _a === void 0 ? void 0 : _a.redirectTo,
          scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
          queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
          skipBrowserRedirect: (_d = credentials.options) === null || _d === void 0 ? void 0 : _d.skipBrowserRedirect
        });
      }
      /**
       * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
       */
      async exchangeCodeForSession(authCode) {
        await this.initializePromise;
        return this._acquireLock(this.lockAcquireTimeout, async () => {
          return this._exchangeCodeForSession(authCode);
        });
      }
      /**
       * Signs in a user by verifying a message signed by the user's private key.
       * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
       * both of which derive from the EIP-4361 standard
       * With slight variation on Solana's side.
       * @reference https://eips.ethereum.org/EIPS/eip-4361
       */
      async signInWithWeb3(credentials) {
        const { chain } = credentials;
        switch (chain) {
          case "ethereum":
            return await this.signInWithEthereum(credentials);
          case "solana":
            return await this.signInWithSolana(credentials);
          default:
            throw new Error(`@supabase/auth-js: Unsupported chain "${chain}"`);
        }
      }
      async signInWithEthereum(credentials) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        let message;
        let signature;
        if ("message" in credentials) {
          message = credentials.message;
          signature = credentials.signature;
        } else {
          const { chain, wallet, statement, options } = credentials;
          let resolvedWallet;
          if (!(0, helpers_1.isBrowser)()) {
            if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
              throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
            }
            resolvedWallet = wallet;
          } else if (typeof wallet === "object") {
            resolvedWallet = wallet;
          } else {
            const windowAny = window;
            if ("ethereum" in windowAny && typeof windowAny.ethereum === "object" && "request" in windowAny.ethereum && typeof windowAny.ethereum.request === "function") {
              resolvedWallet = windowAny.ethereum;
            } else {
              throw new Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`);
            }
          }
          const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
          const accounts = await resolvedWallet.request({
            method: "eth_requestAccounts"
          }).then((accs) => accs).catch(() => {
            throw new Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`);
          });
          if (!accounts || accounts.length === 0) {
            throw new Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);
          }
          const address = (0, ethereum_1.getAddress)(accounts[0]);
          let chainId = (_b = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _b === void 0 ? void 0 : _b.chainId;
          if (!chainId) {
            const chainIdHex = await resolvedWallet.request({
              method: "eth_chainId"
            });
            chainId = (0, ethereum_1.fromHex)(chainIdHex);
          }
          const siweMessage = {
            domain: url.host,
            address,
            statement,
            uri: url.href,
            version: "1",
            chainId,
            nonce: (_c = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _c === void 0 ? void 0 : _c.nonce,
            issuedAt: (_e = (_d = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _d === void 0 ? void 0 : _d.issuedAt) !== null && _e !== void 0 ? _e : /* @__PURE__ */ new Date(),
            expirationTime: (_f = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _f === void 0 ? void 0 : _f.expirationTime,
            notBefore: (_g = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _g === void 0 ? void 0 : _g.notBefore,
            requestId: (_h = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _h === void 0 ? void 0 : _h.requestId,
            resources: (_j = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _j === void 0 ? void 0 : _j.resources
          };
          message = (0, ethereum_1.createSiweMessage)(siweMessage);
          signature = await resolvedWallet.request({
            method: "personal_sign",
            params: [(0, ethereum_1.toHex)(message), address]
          });
        }
        try {
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
            headers: this.headers,
            body: Object.assign({
              chain: "ethereum",
              message,
              signature
            }, ((_k = credentials.options) === null || _k === void 0 ? void 0 : _k.captchaToken) ? { gotrue_meta_security: { captcha_token: (_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken } } : null),
            xform: fetch_1._sessionResponse
          });
          if (error) {
            throw error;
          }
          if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({ data: Object.assign({}, data), error });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      async signInWithSolana(credentials) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        let message;
        let signature;
        if ("message" in credentials) {
          message = credentials.message;
          signature = credentials.signature;
        } else {
          const { chain, wallet, statement, options } = credentials;
          let resolvedWallet;
          if (!(0, helpers_1.isBrowser)()) {
            if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
              throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
            }
            resolvedWallet = wallet;
          } else if (typeof wallet === "object") {
            resolvedWallet = wallet;
          } else {
            const windowAny = window;
            if ("solana" in windowAny && typeof windowAny.solana === "object" && ("signIn" in windowAny.solana && typeof windowAny.solana.signIn === "function" || "signMessage" in windowAny.solana && typeof windowAny.solana.signMessage === "function")) {
              resolvedWallet = windowAny.solana;
            } else {
              throw new Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`);
            }
          }
          const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
          if ("signIn" in resolvedWallet && resolvedWallet.signIn) {
            const output = await resolvedWallet.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, options === null || options === void 0 ? void 0 : options.signInWithSolana), {
              // non-overridable properties
              version: "1",
              domain: url.host,
              uri: url.href
            }), statement ? { statement } : null));
            let outputToProcess;
            if (Array.isArray(output) && output[0] && typeof output[0] === "object") {
              outputToProcess = output[0];
            } else if (output && typeof output === "object" && "signedMessage" in output && "signature" in output) {
              outputToProcess = output;
            } else {
              throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
            }
            if ("signedMessage" in outputToProcess && "signature" in outputToProcess && (typeof outputToProcess.signedMessage === "string" || outputToProcess.signedMessage instanceof Uint8Array) && outputToProcess.signature instanceof Uint8Array) {
              message = typeof outputToProcess.signedMessage === "string" ? outputToProcess.signedMessage : new TextDecoder().decode(outputToProcess.signedMessage);
              signature = outputToProcess.signature;
            } else {
              throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
            }
          } else {
            if (!("signMessage" in resolvedWallet) || typeof resolvedWallet.signMessage !== "function" || !("publicKey" in resolvedWallet) || typeof resolvedWallet !== "object" || !resolvedWallet.publicKey || !("toBase58" in resolvedWallet.publicKey) || typeof resolvedWallet.publicKey.toBase58 !== "function") {
              throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
            }
            message = [
              `${url.host} wants you to sign in with your Solana account:`,
              resolvedWallet.publicKey.toBase58(),
              ...statement ? ["", statement, ""] : [""],
              "Version: 1",
              `URI: ${url.href}`,
              `Issued At: ${(_c = (_b = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _b === void 0 ? void 0 : _b.issuedAt) !== null && _c !== void 0 ? _c : (/* @__PURE__ */ new Date()).toISOString()}`,
              ...((_d = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _d === void 0 ? void 0 : _d.notBefore) ? [`Not Before: ${options.signInWithSolana.notBefore}`] : [],
              ...((_e = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _e === void 0 ? void 0 : _e.expirationTime) ? [`Expiration Time: ${options.signInWithSolana.expirationTime}`] : [],
              ...((_f = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _f === void 0 ? void 0 : _f.chainId) ? [`Chain ID: ${options.signInWithSolana.chainId}`] : [],
              ...((_g = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _g === void 0 ? void 0 : _g.nonce) ? [`Nonce: ${options.signInWithSolana.nonce}`] : [],
              ...((_h = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _h === void 0 ? void 0 : _h.requestId) ? [`Request ID: ${options.signInWithSolana.requestId}`] : [],
              ...((_k = (_j = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _j === void 0 ? void 0 : _j.resources) === null || _k === void 0 ? void 0 : _k.length) ? [
                "Resources",
                ...options.signInWithSolana.resources.map((resource) => `- ${resource}`)
              ] : []
            ].join("\n");
            const maybeSignature = await resolvedWallet.signMessage(new TextEncoder().encode(message), "utf8");
            if (!maybeSignature || !(maybeSignature instanceof Uint8Array)) {
              throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
            }
            signature = maybeSignature;
          }
        }
        try {
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
            headers: this.headers,
            body: Object.assign({ chain: "solana", message, signature: (0, base64url_1.bytesToBase64URL)(signature) }, ((_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken) ? { gotrue_meta_security: { captcha_token: (_m = credentials.options) === null || _m === void 0 ? void 0 : _m.captchaToken } } : null),
            xform: fetch_1._sessionResponse
          });
          if (error) {
            throw error;
          }
          if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({ data: Object.assign({}, data), error });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      async _exchangeCodeForSession(authCode) {
        const storageItem = await (0, helpers_1.getItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
        const [codeVerifier, redirectType] = (storageItem !== null && storageItem !== void 0 ? storageItem : "").split("/");
        try {
          if (!codeVerifier && this.flowType === "pkce") {
            throw new errors_1.AuthPKCECodeVerifierMissingError();
          }
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, {
            headers: this.headers,
            body: {
              auth_code: authCode,
              code_verifier: codeVerifier
            },
            xform: fetch_1._sessionResponse
          });
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if (error) {
            throw error;
          }
          if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({
              data: { user: null, session: null, redirectType: null },
              error: invalidTokenError
            });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({ data: Object.assign(Object.assign({}, data), { redirectType: redirectType !== null && redirectType !== void 0 ? redirectType : null }), error });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({
              data: { user: null, session: null, redirectType: null },
              error
            });
          }
          throw error;
        }
      }
      /**
       * Allows signing in with an OIDC ID token. The authentication provider used
       * should be enabled and configured.
       */
      async signInWithIdToken(credentials) {
        try {
          const { options, provider, token, access_token, nonce } = credentials;
          const res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
            headers: this.headers,
            body: {
              provider,
              id_token: token,
              access_token,
              nonce,
              gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
            },
            xform: fetch_1._sessionResponse
          });
          const { data, error } = res;
          if (error) {
            return this._returnResult({ data: { user: null, session: null }, error });
          } else if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({ data, error });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in a user using magiclink or a one-time password (OTP).
       *
       * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
       * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
       * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
       *
       * Be aware that you may get back an error message that will not distinguish
       * between the cases where the account does not exist or, that the account
       * can only be accessed via social login.
       *
       * Do note that you will need to configure a Whatsapp sender on Twilio
       * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
       * channel is not supported on other providers
       * at this time.
       * This method supports PKCE when an email is passed.
       */
      async signInWithOtp(credentials) {
        var _a, _b, _c, _d, _e;
        try {
          if ("email" in credentials) {
            const { email, options } = credentials;
            let codeChallenge = null;
            let codeChallengeMethod = null;
            if (this.flowType === "pkce") {
              ;
              [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
            }
            const { error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/otp`, {
              headers: this.headers,
              body: {
                email,
                data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
                create_user: (_b = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _b !== void 0 ? _b : true,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
                code_challenge: codeChallenge,
                code_challenge_method: codeChallengeMethod
              },
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
            });
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          if ("phone" in credentials) {
            const { phone, options } = credentials;
            const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/otp`, {
              headers: this.headers,
              body: {
                phone,
                data: (_c = options === null || options === void 0 ? void 0 : options.data) !== null && _c !== void 0 ? _c : {},
                create_user: (_d = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _d !== void 0 ? _d : true,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
                channel: (_e = options === null || options === void 0 ? void 0 : options.channel) !== null && _e !== void 0 ? _e : "sms"
              }
            });
            return this._returnResult({
              data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
              error
            });
          }
          throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number.");
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
       */
      async verifyOtp(params) {
        var _a, _b;
        try {
          let redirectTo = void 0;
          let captchaToken = void 0;
          if ("options" in params) {
            redirectTo = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo;
            captchaToken = (_b = params.options) === null || _b === void 0 ? void 0 : _b.captchaToken;
          }
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/verify`, {
            headers: this.headers,
            body: Object.assign(Object.assign({}, params), { gotrue_meta_security: { captcha_token: captchaToken } }),
            redirectTo,
            xform: fetch_1._sessionResponse
          });
          if (error) {
            throw error;
          }
          if (!data) {
            const tokenVerificationError = new Error("An error occurred on token verification.");
            throw tokenVerificationError;
          }
          const session = data.session;
          const user = data.user;
          if (session === null || session === void 0 ? void 0 : session.access_token) {
            await this._saveSession(session);
            await this._notifyAllSubscribers(params.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", session);
          }
          return this._returnResult({ data: { user, session }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Attempts a single-sign on using an enterprise Identity Provider. A
       * successful SSO attempt will redirect the current page to the identity
       * provider authorization page. The redirect URL is implementation and SSO
       * protocol specific.
       *
       * You can use it by providing a SSO domain. Typically you can extract this
       * domain by asking users for their email address. If this domain is
       * registered on the Auth instance the redirect will use that organization's
       * currently active SSO Identity Provider for the login.
       *
       * If you have built an organization-specific login page, you can use the
       * organization's SSO Identity Provider UUID directly instead.
       */
      async signInWithSSO(params) {
        var _a, _b, _c, _d, _e;
        try {
          let codeChallenge = null;
          let codeChallengeMethod = null;
          if (this.flowType === "pkce") {
            ;
            [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
          }
          const result = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/sso`, {
            body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in params ? { provider_id: params.providerId } : null), "domain" in params ? { domain: params.domain } : null), { redirect_to: (_b = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo) !== null && _b !== void 0 ? _b : void 0 }), ((_c = params === null || params === void 0 ? void 0 : params.options) === null || _c === void 0 ? void 0 : _c.captchaToken) ? { gotrue_meta_security: { captcha_token: params.options.captchaToken } } : null), { skip_http_redirect: true, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
            headers: this.headers,
            xform: fetch_1._ssoResponse
          });
          if (((_d = result.data) === null || _d === void 0 ? void 0 : _d.url) && (0, helpers_1.isBrowser)() && !((_e = params.options) === null || _e === void 0 ? void 0 : _e.skipBrowserRedirect)) {
            window.location.assign(result.data.url);
          }
          return this._returnResult(result);
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Sends a reauthentication OTP to the user's email or phone number.
       * Requires the user to be signed-in.
       */
      async reauthenticate() {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._reauthenticate();
        });
      }
      async _reauthenticate() {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError)
              throw sessionError;
            if (!session)
              throw new errors_1.AuthSessionMissingError();
            const { error } = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/reauthenticate`, {
              headers: this.headers,
              jwt: session.access_token
            });
            return this._returnResult({ data: { user: null, session: null }, error });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
       */
      async resend(credentials) {
        try {
          const endpoint = `${this.url}/resend`;
          if ("email" in credentials) {
            const { email, type, options } = credentials;
            const { error } = await (0, fetch_1._request)(this.fetch, "POST", endpoint, {
              headers: this.headers,
              body: {
                email,
                type,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
            });
            return this._returnResult({ data: { user: null, session: null }, error });
          } else if ("phone" in credentials) {
            const { phone, type, options } = credentials;
            const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", endpoint, {
              headers: this.headers,
              body: {
                phone,
                type,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              }
            });
            return this._returnResult({
              data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
              error
            });
          }
          throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number and a type");
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Returns the session, refreshing it if necessary.
       *
       * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
       *
       * **IMPORTANT:** This method loads values directly from the storage attached
       * to the client. If that storage is based on request cookies for example,
       * the values in it may not be authentic and therefore it's strongly advised
       * against using this method and its results in such circumstances. A warning
       * will be emitted if this is detected. Use {@link #getUser()} instead.
       */
      async getSession() {
        await this.initializePromise;
        const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
          return this._useSession(async (result2) => {
            return result2;
          });
        });
        return result;
      }
      /**
       * Acquires a global lock based on the storage key.
       */
      async _acquireLock(acquireTimeout, fn) {
        this._debug("#_acquireLock", "begin", acquireTimeout);
        try {
          if (this.lockAcquired) {
            const last = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve();
            const result = (async () => {
              await last;
              return await fn();
            })();
            this.pendingInLock.push((async () => {
              try {
                await result;
              } catch (e) {
              }
            })());
            return result;
          }
          return await this.lock(`lock:${this.storageKey}`, acquireTimeout, async () => {
            this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
            try {
              this.lockAcquired = true;
              const result = fn();
              this.pendingInLock.push((async () => {
                try {
                  await result;
                } catch (e) {
                }
              })());
              await result;
              while (this.pendingInLock.length) {
                const waitOn = [...this.pendingInLock];
                await Promise.all(waitOn);
                this.pendingInLock.splice(0, waitOn.length);
              }
              return await result;
            } finally {
              this._debug("#_acquireLock", "lock released for storage key", this.storageKey);
              this.lockAcquired = false;
            }
          });
        } finally {
          this._debug("#_acquireLock", "end");
        }
      }
      /**
       * Use instead of {@link #getSession} inside the library. It is
       * semantically usually what you want, as getting a session involves some
       * processing afterwards that requires only one client operating on the
       * session at once across multiple tabs or processes.
       */
      async _useSession(fn) {
        this._debug("#_useSession", "begin");
        try {
          const result = await this.__loadSession();
          return await fn(result);
        } finally {
          this._debug("#_useSession", "end");
        }
      }
      /**
       * NEVER USE DIRECTLY!
       *
       * Always use {@link #_useSession}.
       */
      async __loadSession() {
        this._debug("#__loadSession()", "begin");
        if (!this.lockAcquired) {
          this._debug("#__loadSession()", "used outside of an acquired lock!", new Error().stack);
        }
        try {
          let currentSession = null;
          const maybeSession = await (0, helpers_1.getItemAsync)(this.storage, this.storageKey);
          this._debug("#getSession()", "session from storage", maybeSession);
          if (maybeSession !== null) {
            if (this._isValidSession(maybeSession)) {
              currentSession = maybeSession;
            } else {
              this._debug("#getSession()", "session from storage is not valid");
              await this._removeSession();
            }
          }
          if (!currentSession) {
            return { data: { session: null }, error: null };
          }
          const hasExpired = currentSession.expires_at ? currentSession.expires_at * 1e3 - Date.now() < constants_1.EXPIRY_MARGIN_MS : false;
          this._debug("#__loadSession()", `session has${hasExpired ? "" : " not"} expired`, "expires_at", currentSession.expires_at);
          if (!hasExpired) {
            if (this.userStorage) {
              const maybeUser = await (0, helpers_1.getItemAsync)(this.userStorage, this.storageKey + "-user");
              if (maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) {
                currentSession.user = maybeUser.user;
              } else {
                currentSession.user = (0, helpers_1.userNotAvailableProxy)();
              }
            }
            if (this.storage.isServer && currentSession.user && !currentSession.user.__isUserNotAvailableProxy) {
              const suppressWarningRef = { value: this.suppressGetSessionWarning };
              currentSession.user = (0, helpers_1.insecureUserWarningProxy)(currentSession.user, suppressWarningRef);
              if (suppressWarningRef.value) {
                this.suppressGetSessionWarning = true;
              }
            }
            return { data: { session: currentSession }, error: null };
          }
          const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
          if (error) {
            return this._returnResult({ data: { session: null }, error });
          }
          return this._returnResult({ data: { session }, error: null });
        } finally {
          this._debug("#__loadSession()", "end");
        }
      }
      /**
       * Gets the current user details if there is an existing session. This method
       * performs a network request to the Supabase Auth server, so the returned
       * value is authentic and can be used to base authorization rules on.
       *
       * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
       */
      async getUser(jwt) {
        if (jwt) {
          return await this._getUser(jwt);
        }
        await this.initializePromise;
        const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._getUser();
        });
        if (result.data.user) {
          this.suppressGetSessionWarning = true;
        }
        return result;
      }
      async _getUser(jwt) {
        try {
          if (jwt) {
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/user`, {
              headers: this.headers,
              jwt,
              xform: fetch_1._userResponse
            });
          }
          return await this._useSession(async (result) => {
            var _a, _b, _c;
            const { data, error } = result;
            if (error) {
              throw error;
            }
            if (!((_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) && !this.hasCustomAuthorizationHeader) {
              return { data: { user: null }, error: new errors_1.AuthSessionMissingError() };
            }
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/user`, {
              headers: this.headers,
              jwt: (_c = (_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) !== null && _c !== void 0 ? _c : void 0,
              xform: fetch_1._userResponse
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            if ((0, errors_1.isAuthSessionMissingError)(error)) {
              await this._removeSession();
              await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
            }
            return this._returnResult({ data: { user: null }, error });
          }
          throw error;
        }
      }
      /**
       * Updates user data for a logged in user.
       */
      async updateUser(attributes, options = {}) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._updateUser(attributes, options);
        });
      }
      async _updateUser(attributes, options = {}) {
        try {
          return await this._useSession(async (result) => {
            const { data: sessionData, error: sessionError } = result;
            if (sessionError) {
              throw sessionError;
            }
            if (!sessionData.session) {
              throw new errors_1.AuthSessionMissingError();
            }
            const session = sessionData.session;
            let codeChallenge = null;
            let codeChallengeMethod = null;
            if (this.flowType === "pkce" && attributes.email != null) {
              ;
              [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
            }
            const { data, error: userError } = await (0, fetch_1._request)(this.fetch, "PUT", `${this.url}/user`, {
              headers: this.headers,
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
              body: Object.assign(Object.assign({}, attributes), { code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
              jwt: session.access_token,
              xform: fetch_1._userResponse
            });
            if (userError) {
              throw userError;
            }
            session.user = data.user;
            await this._saveSession(session);
            await this._notifyAllSubscribers("USER_UPDATED", session);
            return this._returnResult({ data: { user: session.user }, error: null });
          });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null }, error });
          }
          throw error;
        }
      }
      /**
       * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
       * If the refresh token or access token in the current session is invalid, an error will be thrown.
       * @param currentSession The current session that minimally contains an access token and refresh token.
       */
      async setSession(currentSession) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._setSession(currentSession);
        });
      }
      async _setSession(currentSession) {
        try {
          if (!currentSession.access_token || !currentSession.refresh_token) {
            throw new errors_1.AuthSessionMissingError();
          }
          const timeNow = Date.now() / 1e3;
          let expiresAt = timeNow;
          let hasExpired = true;
          let session = null;
          const { payload } = (0, helpers_1.decodeJWT)(currentSession.access_token);
          if (payload.exp) {
            expiresAt = payload.exp;
            hasExpired = expiresAt <= timeNow;
          }
          if (hasExpired) {
            const { data: refreshedSession, error } = await this._callRefreshToken(currentSession.refresh_token);
            if (error) {
              return this._returnResult({ data: { user: null, session: null }, error });
            }
            if (!refreshedSession) {
              return { data: { user: null, session: null }, error: null };
            }
            session = refreshedSession;
          } else {
            const { data, error } = await this._getUser(currentSession.access_token);
            if (error) {
              return this._returnResult({ data: { user: null, session: null }, error });
            }
            session = {
              access_token: currentSession.access_token,
              refresh_token: currentSession.refresh_token,
              user: data.user,
              token_type: "bearer",
              expires_in: expiresAt - timeNow,
              expires_at: expiresAt
            };
            await this._saveSession(session);
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
          return this._returnResult({ data: { user: session.user, session }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { session: null, user: null }, error });
          }
          throw error;
        }
      }
      /**
       * Returns a new session, regardless of expiry status.
       * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
       * If the current session's refresh token is invalid, an error will be thrown.
       * @param currentSession The current session. If passed in, it must contain a refresh token.
       */
      async refreshSession(currentSession) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._refreshSession(currentSession);
        });
      }
      async _refreshSession(currentSession) {
        try {
          return await this._useSession(async (result) => {
            var _a;
            if (!currentSession) {
              const { data, error: error2 } = result;
              if (error2) {
                throw error2;
              }
              currentSession = (_a = data.session) !== null && _a !== void 0 ? _a : void 0;
            }
            if (!(currentSession === null || currentSession === void 0 ? void 0 : currentSession.refresh_token)) {
              throw new errors_1.AuthSessionMissingError();
            }
            const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
            if (error) {
              return this._returnResult({ data: { user: null, session: null }, error });
            }
            if (!session) {
              return this._returnResult({ data: { user: null, session: null }, error: null });
            }
            return this._returnResult({ data: { user: session.user, session }, error: null });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Gets the session data from a URL string
       */
      async _getSessionFromURL(params, callbackUrlType) {
        try {
          if (!(0, helpers_1.isBrowser)())
            throw new errors_1.AuthImplicitGrantRedirectError("No browser detected.");
          if (params.error || params.error_description || params.error_code) {
            throw new errors_1.AuthImplicitGrantRedirectError(params.error_description || "Error in URL with unspecified error_description", {
              error: params.error || "unspecified_error",
              code: params.error_code || "unspecified_code"
            });
          }
          switch (callbackUrlType) {
            case "implicit":
              if (this.flowType === "pkce") {
                throw new errors_1.AuthPKCEGrantCodeExchangeError("Not a valid PKCE flow url.");
              }
              break;
            case "pkce":
              if (this.flowType === "implicit") {
                throw new errors_1.AuthImplicitGrantRedirectError("Not a valid implicit grant flow url.");
              }
              break;
            default:
          }
          if (callbackUrlType === "pkce") {
            this._debug("#_initialize()", "begin", "is PKCE flow", true);
            if (!params.code)
              throw new errors_1.AuthPKCEGrantCodeExchangeError("No code detected.");
            const { data: data2, error: error2 } = await this._exchangeCodeForSession(params.code);
            if (error2)
              throw error2;
            const url = new URL(window.location.href);
            url.searchParams.delete("code");
            window.history.replaceState(window.history.state, "", url.toString());
            return { data: { session: data2.session, redirectType: null }, error: null };
          }
          const { provider_token, provider_refresh_token, access_token, refresh_token, expires_in, expires_at, token_type } = params;
          if (!access_token || !expires_in || !refresh_token || !token_type) {
            throw new errors_1.AuthImplicitGrantRedirectError("No session defined in URL");
          }
          const timeNow = Math.round(Date.now() / 1e3);
          const expiresIn = parseInt(expires_in);
          let expiresAt = timeNow + expiresIn;
          if (expires_at) {
            expiresAt = parseInt(expires_at);
          }
          const actuallyExpiresIn = expiresAt - timeNow;
          if (actuallyExpiresIn * 1e3 <= constants_1.AUTO_REFRESH_TICK_DURATION_MS) {
            console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${actuallyExpiresIn}s, should have been closer to ${expiresIn}s`);
          }
          const issuedAt = expiresAt - expiresIn;
          if (timeNow - issuedAt >= 120) {
            console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", issuedAt, expiresAt, timeNow);
          } else if (timeNow - issuedAt < 0) {
            console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", issuedAt, expiresAt, timeNow);
          }
          const { data, error } = await this._getUser(access_token);
          if (error)
            throw error;
          const session = {
            provider_token,
            provider_refresh_token,
            access_token,
            expires_in: expiresIn,
            expires_at: expiresAt,
            refresh_token,
            token_type,
            user: data.user
          };
          window.location.hash = "";
          this._debug("#_getSessionFromURL()", "clearing window.location.hash");
          return this._returnResult({ data: { session, redirectType: params.type }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { session: null, redirectType: null }, error });
          }
          throw error;
        }
      }
      /**
       * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
       *
       * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
       * if the URL should be processed as a Supabase auth callback. This allows users to exclude
       * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
       */
      _isImplicitGrantCallback(params) {
        if (typeof this.detectSessionInUrl === "function") {
          return this.detectSessionInUrl(new URL(window.location.href), params);
        }
        return Boolean(params.access_token || params.error_description);
      }
      /**
       * Checks if the current URL and backing storage contain parameters given by a PKCE flow
       */
      async _isPKCECallback(params) {
        const currentStorageContent = await (0, helpers_1.getItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
        return !!(params.code && currentStorageContent);
      }
      /**
       * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
       *
       * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
       * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
       *
       * If using `others` scope, no `SIGNED_OUT` event is fired!
       */
      async signOut(options = { scope: "global" }) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._signOut(options);
        });
      }
      async _signOut({ scope } = { scope: "global" }) {
        return await this._useSession(async (result) => {
          var _a;
          const { data, error: sessionError } = result;
          if (sessionError && !(0, errors_1.isAuthSessionMissingError)(sessionError)) {
            return this._returnResult({ error: sessionError });
          }
          const accessToken = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token;
          if (accessToken) {
            const { error } = await this.admin.signOut(accessToken, scope);
            if (error) {
              if (!((0, errors_1.isAuthApiError)(error) && (error.status === 404 || error.status === 401 || error.status === 403) || (0, errors_1.isAuthSessionMissingError)(error))) {
                return this._returnResult({ error });
              }
            }
          }
          if (scope !== "others") {
            await this._removeSession();
            await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          }
          return this._returnResult({ error: null });
        });
      }
      onAuthStateChange(callback) {
        const id = (0, helpers_1.generateCallbackId)();
        const subscription = {
          id,
          callback,
          unsubscribe: () => {
            this._debug("#unsubscribe()", "state change callback with id removed", id);
            this.stateChangeEmitters.delete(id);
          }
        };
        this._debug("#onAuthStateChange()", "registered callback with id", id);
        this.stateChangeEmitters.set(id, subscription);
        (async () => {
          await this.initializePromise;
          await this._acquireLock(this.lockAcquireTimeout, async () => {
            this._emitInitialSession(id);
          });
        })();
        return { data: { subscription } };
      }
      async _emitInitialSession(id) {
        return await this._useSession(async (result) => {
          var _a, _b;
          try {
            const { data: { session }, error } = result;
            if (error)
              throw error;
            await ((_a = this.stateChangeEmitters.get(id)) === null || _a === void 0 ? void 0 : _a.callback("INITIAL_SESSION", session));
            this._debug("INITIAL_SESSION", "callback id", id, "session", session);
          } catch (err) {
            await ((_b = this.stateChangeEmitters.get(id)) === null || _b === void 0 ? void 0 : _b.callback("INITIAL_SESSION", null));
            this._debug("INITIAL_SESSION", "callback id", id, "error", err);
            console.error(err);
          }
        });
      }
      /**
       * Sends a password reset request to an email address. This method supports the PKCE flow.
       *
       * @param email The email address of the user.
       * @param options.redirectTo The URL to send the user to after they click the password reset link.
       * @param options.captchaToken Verification token received when the user completes the captcha on the site.
       */
      async resetPasswordForEmail(email, options = {}) {
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce") {
          ;
          [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(
            this.storage,
            this.storageKey,
            true
            // isPasswordRecovery
          );
        }
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/recover`, {
            body: {
              email,
              code_challenge: codeChallenge,
              code_challenge_method: codeChallengeMethod,
              gotrue_meta_security: { captcha_token: options.captchaToken }
            },
            headers: this.headers,
            redirectTo: options.redirectTo
          });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Gets all the identities linked to a user.
       */
      async getUserIdentities() {
        var _a;
        try {
          const { data, error } = await this.getUser();
          if (error)
            throw error;
          return this._returnResult({ data: { identities: (_a = data.user.identities) !== null && _a !== void 0 ? _a : [] }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async linkIdentity(credentials) {
        if ("token" in credentials) {
          return this.linkIdentityIdToken(credentials);
        }
        return this.linkIdentityOAuth(credentials);
      }
      async linkIdentityOAuth(credentials) {
        var _a;
        try {
          const { data, error } = await this._useSession(async (result) => {
            var _a2, _b, _c, _d, _e;
            const { data: data2, error: error2 } = result;
            if (error2)
              throw error2;
            const url = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, credentials.provider, {
              redirectTo: (_a2 = credentials.options) === null || _a2 === void 0 ? void 0 : _a2.redirectTo,
              scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
              queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
              skipBrowserRedirect: true
            });
            return await (0, fetch_1._request)(this.fetch, "GET", url, {
              headers: this.headers,
              jwt: (_e = (_d = data2.session) === null || _d === void 0 ? void 0 : _d.access_token) !== null && _e !== void 0 ? _e : void 0
            });
          });
          if (error)
            throw error;
          if ((0, helpers_1.isBrowser)() && !((_a = credentials.options) === null || _a === void 0 ? void 0 : _a.skipBrowserRedirect)) {
            window.location.assign(data === null || data === void 0 ? void 0 : data.url);
          }
          return this._returnResult({
            data: { provider: credentials.provider, url: data === null || data === void 0 ? void 0 : data.url },
            error: null
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { provider: credentials.provider, url: null }, error });
          }
          throw error;
        }
      }
      async linkIdentityIdToken(credentials) {
        return await this._useSession(async (result) => {
          var _a;
          try {
            const { error: sessionError, data: { session } } = result;
            if (sessionError)
              throw sessionError;
            const { options, provider, token, access_token, nonce } = credentials;
            const res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
              headers: this.headers,
              jwt: (_a = session === null || session === void 0 ? void 0 : session.access_token) !== null && _a !== void 0 ? _a : void 0,
              body: {
                provider,
                id_token: token,
                access_token,
                nonce,
                link_identity: true,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponse
            });
            const { data, error } = res;
            if (error) {
              return this._returnResult({ data: { user: null, session: null }, error });
            } else if (!data || !data.session || !data.user) {
              return this._returnResult({
                data: { user: null, session: null },
                error: new errors_1.AuthInvalidTokenResponseError()
              });
            }
            if (data.session) {
              await this._saveSession(data.session);
              await this._notifyAllSubscribers("USER_UPDATED", data.session);
            }
            return this._returnResult({ data, error });
          } catch (error) {
            await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, errors_1.isAuthError)(error)) {
              return this._returnResult({ data: { user: null, session: null }, error });
            }
            throw error;
          }
        });
      }
      /**
       * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
       */
      async unlinkIdentity(identity) {
        try {
          return await this._useSession(async (result) => {
            var _a, _b;
            const { data, error } = result;
            if (error) {
              throw error;
            }
            return await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/user/identities/${identity.identity_id}`, {
              headers: this.headers,
              jwt: (_b = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) !== null && _b !== void 0 ? _b : void 0
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Generates a new JWT.
       * @param refreshToken A valid refresh token that was returned on login.
       */
      async _refreshAccessToken(refreshToken) {
        const debugName = `#_refreshAccessToken(${refreshToken.substring(0, 5)}...)`;
        this._debug(debugName, "begin");
        try {
          const startedAt = Date.now();
          return await (0, helpers_1.retryable)(async (attempt) => {
            if (attempt > 0) {
              await (0, helpers_1.sleep)(200 * Math.pow(2, attempt - 1));
            }
            this._debug(debugName, "refreshing attempt", attempt);
            return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, {
              body: { refresh_token: refreshToken },
              headers: this.headers,
              xform: fetch_1._sessionResponse
            });
          }, (attempt, error) => {
            const nextBackOffInterval = 200 * Math.pow(2, attempt);
            return error && (0, errors_1.isAuthRetryableFetchError)(error) && // retryable only if the request can be sent before the backoff overflows the tick duration
            Date.now() + nextBackOffInterval - startedAt < constants_1.AUTO_REFRESH_TICK_DURATION_MS;
          });
        } catch (error) {
          this._debug(debugName, "error", error);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { session: null, user: null }, error });
          }
          throw error;
        } finally {
          this._debug(debugName, "end");
        }
      }
      _isValidSession(maybeSession) {
        const isValidSession = typeof maybeSession === "object" && maybeSession !== null && "access_token" in maybeSession && "refresh_token" in maybeSession && "expires_at" in maybeSession;
        return isValidSession;
      }
      async _handleProviderSignIn(provider, options) {
        const url = await this._getUrlForProvider(`${this.url}/authorize`, provider, {
          redirectTo: options.redirectTo,
          scopes: options.scopes,
          queryParams: options.queryParams
        });
        this._debug("#_handleProviderSignIn()", "provider", provider, "options", options, "url", url);
        if ((0, helpers_1.isBrowser)() && !options.skipBrowserRedirect) {
          window.location.assign(url);
        }
        return { data: { provider, url }, error: null };
      }
      /**
       * Recovers the session from LocalStorage and refreshes the token
       * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
       */
      async _recoverAndRefresh() {
        var _a, _b;
        const debugName = "#_recoverAndRefresh()";
        this._debug(debugName, "begin");
        try {
          const currentSession = await (0, helpers_1.getItemAsync)(this.storage, this.storageKey);
          if (currentSession && this.userStorage) {
            let maybeUser = await (0, helpers_1.getItemAsync)(this.userStorage, this.storageKey + "-user");
            if (!this.storage.isServer && Object.is(this.storage, this.userStorage) && !maybeUser) {
              maybeUser = { user: currentSession.user };
              await (0, helpers_1.setItemAsync)(this.userStorage, this.storageKey + "-user", maybeUser);
            }
            currentSession.user = (_a = maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) !== null && _a !== void 0 ? _a : (0, helpers_1.userNotAvailableProxy)();
          } else if (currentSession && !currentSession.user) {
            if (!currentSession.user) {
              const separateUser = await (0, helpers_1.getItemAsync)(this.storage, this.storageKey + "-user");
              if (separateUser && (separateUser === null || separateUser === void 0 ? void 0 : separateUser.user)) {
                currentSession.user = separateUser.user;
                await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey + "-user");
                await (0, helpers_1.setItemAsync)(this.storage, this.storageKey, currentSession);
              } else {
                currentSession.user = (0, helpers_1.userNotAvailableProxy)();
              }
            }
          }
          this._debug(debugName, "session from storage", currentSession);
          if (!this._isValidSession(currentSession)) {
            this._debug(debugName, "session is not valid");
            if (currentSession !== null) {
              await this._removeSession();
            }
            return;
          }
          const expiresWithMargin = ((_b = currentSession.expires_at) !== null && _b !== void 0 ? _b : Infinity) * 1e3 - Date.now() < constants_1.EXPIRY_MARGIN_MS;
          this._debug(debugName, `session has${expiresWithMargin ? "" : " not"} expired with margin of ${constants_1.EXPIRY_MARGIN_MS}s`);
          if (expiresWithMargin) {
            if (this.autoRefreshToken && currentSession.refresh_token) {
              const { error } = await this._callRefreshToken(currentSession.refresh_token);
              if (error) {
                console.error(error);
                if (!(0, errors_1.isAuthRetryableFetchError)(error)) {
                  this._debug(debugName, "refresh failed with a non-retryable error, removing the session", error);
                  await this._removeSession();
                }
              }
            }
          } else if (currentSession.user && currentSession.user.__isUserNotAvailableProxy === true) {
            try {
              const { data, error: userError } = await this._getUser(currentSession.access_token);
              if (!userError && (data === null || data === void 0 ? void 0 : data.user)) {
                currentSession.user = data.user;
                await this._saveSession(currentSession);
                await this._notifyAllSubscribers("SIGNED_IN", currentSession);
              } else {
                this._debug(debugName, "could not get user data, skipping SIGNED_IN notification");
              }
            } catch (getUserError) {
              console.error("Error getting user data:", getUserError);
              this._debug(debugName, "error getting user data, skipping SIGNED_IN notification", getUserError);
            }
          } else {
            await this._notifyAllSubscribers("SIGNED_IN", currentSession);
          }
        } catch (err) {
          this._debug(debugName, "error", err);
          console.error(err);
          return;
        } finally {
          this._debug(debugName, "end");
        }
      }
      async _callRefreshToken(refreshToken) {
        var _a, _b;
        if (!refreshToken) {
          throw new errors_1.AuthSessionMissingError();
        }
        if (this.refreshingDeferred) {
          return this.refreshingDeferred.promise;
        }
        const debugName = `#_callRefreshToken(${refreshToken.substring(0, 5)}...)`;
        this._debug(debugName, "begin");
        try {
          this.refreshingDeferred = new helpers_1.Deferred();
          const { data, error } = await this._refreshAccessToken(refreshToken);
          if (error)
            throw error;
          if (!data.session)
            throw new errors_1.AuthSessionMissingError();
          await this._saveSession(data.session);
          await this._notifyAllSubscribers("TOKEN_REFRESHED", data.session);
          const result = { data: data.session, error: null };
          this.refreshingDeferred.resolve(result);
          return result;
        } catch (error) {
          this._debug(debugName, "error", error);
          if ((0, errors_1.isAuthError)(error)) {
            const result = { data: null, error };
            if (!(0, errors_1.isAuthRetryableFetchError)(error)) {
              await this._removeSession();
            }
            (_a = this.refreshingDeferred) === null || _a === void 0 ? void 0 : _a.resolve(result);
            return result;
          }
          (_b = this.refreshingDeferred) === null || _b === void 0 ? void 0 : _b.reject(error);
          throw error;
        } finally {
          this.refreshingDeferred = null;
          this._debug(debugName, "end");
        }
      }
      async _notifyAllSubscribers(event, session, broadcast = true) {
        const debugName = `#_notifyAllSubscribers(${event})`;
        this._debug(debugName, "begin", session, `broadcast = ${broadcast}`);
        try {
          if (this.broadcastChannel && broadcast) {
            this.broadcastChannel.postMessage({ event, session });
          }
          const errors = [];
          const promises = Array.from(this.stateChangeEmitters.values()).map(async (x) => {
            try {
              await x.callback(event, session);
            } catch (e) {
              errors.push(e);
            }
          });
          await Promise.all(promises);
          if (errors.length > 0) {
            for (let i = 0; i < errors.length; i += 1) {
              console.error(errors[i]);
            }
            throw errors[0];
          }
        } finally {
          this._debug(debugName, "end");
        }
      }
      /**
       * set currentSession and currentUser
       * process to _startAutoRefreshToken if possible
       */
      async _saveSession(session) {
        this._debug("#_saveSession()", session);
        this.suppressGetSessionWarning = true;
        await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
        const sessionToProcess = Object.assign({}, session);
        const userIsProxy = sessionToProcess.user && sessionToProcess.user.__isUserNotAvailableProxy === true;
        if (this.userStorage) {
          if (!userIsProxy && sessionToProcess.user) {
            await (0, helpers_1.setItemAsync)(this.userStorage, this.storageKey + "-user", {
              user: sessionToProcess.user
            });
          } else if (userIsProxy) {
          }
          const mainSessionData = Object.assign({}, sessionToProcess);
          delete mainSessionData.user;
          const clonedMainSessionData = (0, helpers_1.deepClone)(mainSessionData);
          await (0, helpers_1.setItemAsync)(this.storage, this.storageKey, clonedMainSessionData);
        } else {
          const clonedSession = (0, helpers_1.deepClone)(sessionToProcess);
          await (0, helpers_1.setItemAsync)(this.storage, this.storageKey, clonedSession);
        }
      }
      async _removeSession() {
        this._debug("#_removeSession()");
        this.suppressGetSessionWarning = false;
        await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey);
        await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey + "-code-verifier");
        await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey + "-user");
        if (this.userStorage) {
          await (0, helpers_1.removeItemAsync)(this.userStorage, this.storageKey + "-user");
        }
        await this._notifyAllSubscribers("SIGNED_OUT", null);
      }
      /**
       * Removes any registered visibilitychange callback.
       *
       * {@see #startAutoRefresh}
       * {@see #stopAutoRefresh}
       */
      _removeVisibilityChangedCallback() {
        this._debug("#_removeVisibilityChangedCallback()");
        const callback = this.visibilityChangedCallback;
        this.visibilityChangedCallback = null;
        try {
          if (callback && (0, helpers_1.isBrowser)() && (window === null || window === void 0 ? void 0 : window.removeEventListener)) {
            window.removeEventListener("visibilitychange", callback);
          }
        } catch (e) {
          console.error("removing visibilitychange callback failed", e);
        }
      }
      /**
       * This is the private implementation of {@link #startAutoRefresh}. Use this
       * within the library.
       */
      async _startAutoRefresh() {
        await this._stopAutoRefresh();
        this._debug("#_startAutoRefresh()");
        const ticker = setInterval(() => this._autoRefreshTokenTick(), constants_1.AUTO_REFRESH_TICK_DURATION_MS);
        this.autoRefreshTicker = ticker;
        if (ticker && typeof ticker === "object" && typeof ticker.unref === "function") {
          ticker.unref();
        } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
          Deno.unrefTimer(ticker);
        }
        const timeout = setTimeout(async () => {
          await this.initializePromise;
          await this._autoRefreshTokenTick();
        }, 0);
        this.autoRefreshTickTimeout = timeout;
        if (timeout && typeof timeout === "object" && typeof timeout.unref === "function") {
          timeout.unref();
        } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
          Deno.unrefTimer(timeout);
        }
      }
      /**
       * This is the private implementation of {@link #stopAutoRefresh}. Use this
       * within the library.
       */
      async _stopAutoRefresh() {
        this._debug("#_stopAutoRefresh()");
        const ticker = this.autoRefreshTicker;
        this.autoRefreshTicker = null;
        if (ticker) {
          clearInterval(ticker);
        }
        const timeout = this.autoRefreshTickTimeout;
        this.autoRefreshTickTimeout = null;
        if (timeout) {
          clearTimeout(timeout);
        }
      }
      /**
       * Starts an auto-refresh process in the background. The session is checked
       * every few seconds. Close to the time of expiration a process is started to
       * refresh the session. If refreshing fails it will be retried for as long as
       * necessary.
       *
       * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
       * to call this function, it will be called for you.
       *
       * On browsers the refresh process works only when the tab/window is in the
       * foreground to conserve resources as well as prevent race conditions and
       * flooding auth with requests. If you call this method any managed
       * visibility change callback will be removed and you must manage visibility
       * changes on your own.
       *
       * On non-browser platforms the refresh process works *continuously* in the
       * background, which may not be desirable. You should hook into your
       * platform's foreground indication mechanism and call these methods
       * appropriately to conserve resources.
       *
       * {@see #stopAutoRefresh}
       */
      async startAutoRefresh() {
        this._removeVisibilityChangedCallback();
        await this._startAutoRefresh();
      }
      /**
       * Stops an active auto refresh process running in the background (if any).
       *
       * If you call this method any managed visibility change callback will be
       * removed and you must manage visibility changes on your own.
       *
       * See {@link #startAutoRefresh} for more details.
       */
      async stopAutoRefresh() {
        this._removeVisibilityChangedCallback();
        await this._stopAutoRefresh();
      }
      /**
       * Runs the auto refresh token tick.
       */
      async _autoRefreshTokenTick() {
        this._debug("#_autoRefreshTokenTick()", "begin");
        try {
          await this._acquireLock(0, async () => {
            try {
              const now = Date.now();
              try {
                return await this._useSession(async (result) => {
                  const { data: { session } } = result;
                  if (!session || !session.refresh_token || !session.expires_at) {
                    this._debug("#_autoRefreshTokenTick()", "no session");
                    return;
                  }
                  const expiresInTicks = Math.floor((session.expires_at * 1e3 - now) / constants_1.AUTO_REFRESH_TICK_DURATION_MS);
                  this._debug("#_autoRefreshTokenTick()", `access token expires in ${expiresInTicks} ticks, a tick lasts ${constants_1.AUTO_REFRESH_TICK_DURATION_MS}ms, refresh threshold is ${constants_1.AUTO_REFRESH_TICK_THRESHOLD} ticks`);
                  if (expiresInTicks <= constants_1.AUTO_REFRESH_TICK_THRESHOLD) {
                    await this._callRefreshToken(session.refresh_token);
                  }
                });
              } catch (e) {
                console.error("Auto refresh tick failed with error. This is likely a transient error.", e);
              }
            } finally {
              this._debug("#_autoRefreshTokenTick()", "end");
            }
          });
        } catch (e) {
          if (e.isAcquireTimeout || e instanceof locks_1.LockAcquireTimeoutError) {
            this._debug("auto refresh token tick lock not available");
          } else {
            throw e;
          }
        }
      }
      /**
       * Registers callbacks on the browser / platform, which in-turn run
       * algorithms when the browser window/tab are in foreground. On non-browser
       * platforms it assumes always foreground.
       */
      async _handleVisibilityChange() {
        this._debug("#_handleVisibilityChange()");
        if (!(0, helpers_1.isBrowser)() || !(window === null || window === void 0 ? void 0 : window.addEventListener)) {
          if (this.autoRefreshToken) {
            this.startAutoRefresh();
          }
          return false;
        }
        try {
          this.visibilityChangedCallback = async () => {
            try {
              await this._onVisibilityChanged(false);
            } catch (error) {
              this._debug("#visibilityChangedCallback", "error", error);
            }
          };
          window === null || window === void 0 ? void 0 : window.addEventListener("visibilitychange", this.visibilityChangedCallback);
          await this._onVisibilityChanged(true);
        } catch (error) {
          console.error("_handleVisibilityChange", error);
        }
      }
      /**
       * Callback registered with `window.addEventListener('visibilitychange')`.
       */
      async _onVisibilityChanged(calledFromInitialize) {
        const methodName = `#_onVisibilityChanged(${calledFromInitialize})`;
        this._debug(methodName, "visibilityState", document.visibilityState);
        if (document.visibilityState === "visible") {
          if (this.autoRefreshToken) {
            this._startAutoRefresh();
          }
          if (!calledFromInitialize) {
            await this.initializePromise;
            await this._acquireLock(this.lockAcquireTimeout, async () => {
              if (document.visibilityState !== "visible") {
                this._debug(methodName, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
                return;
              }
              await this._recoverAndRefresh();
            });
          }
        } else if (document.visibilityState === "hidden") {
          if (this.autoRefreshToken) {
            this._stopAutoRefresh();
          }
        }
      }
      /**
       * Generates the relevant login URL for a third-party provider.
       * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
       * @param options.scopes A space-separated list of scopes granted to the OAuth application.
       * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
       */
      async _getUrlForProvider(url, provider, options) {
        const urlParams = [`provider=${encodeURIComponent(provider)}`];
        if (options === null || options === void 0 ? void 0 : options.redirectTo) {
          urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`);
        }
        if (options === null || options === void 0 ? void 0 : options.scopes) {
          urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`);
        }
        if (this.flowType === "pkce") {
          const [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
          const flowParams = new URLSearchParams({
            code_challenge: `${encodeURIComponent(codeChallenge)}`,
            code_challenge_method: `${encodeURIComponent(codeChallengeMethod)}`
          });
          urlParams.push(flowParams.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.queryParams) {
          const query = new URLSearchParams(options.queryParams);
          urlParams.push(query.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.skipBrowserRedirect) {
          urlParams.push(`skip_http_redirect=${options.skipBrowserRedirect}`);
        }
        return `${url}?${urlParams.join("&")}`;
      }
      async _unenroll(params) {
        try {
          return await this._useSession(async (result) => {
            var _a;
            const { data: sessionData, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            return await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/factors/${params.factorId}`, {
              headers: this.headers,
              jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async _enroll(params) {
        try {
          return await this._useSession(async (result) => {
            var _a, _b;
            const { data: sessionData, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            const body = Object.assign({ friendly_name: params.friendlyName, factor_type: params.factorType }, params.factorType === "phone" ? { phone: params.phone } : params.factorType === "totp" ? { issuer: params.issuer } : {});
            const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/factors`, {
              body,
              headers: this.headers,
              jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
            });
            if (error) {
              return this._returnResult({ data: null, error });
            }
            if (params.factorType === "totp" && data.type === "totp" && ((_b = data === null || data === void 0 ? void 0 : data.totp) === null || _b === void 0 ? void 0 : _b.qr_code)) {
              data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`;
            }
            return this._returnResult({ data, error: null });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async _verify(params) {
        return this._acquireLock(this.lockAcquireTimeout, async () => {
          try {
            return await this._useSession(async (result) => {
              var _a;
              const { data: sessionData, error: sessionError } = result;
              if (sessionError) {
                return this._returnResult({ data: null, error: sessionError });
              }
              const body = Object.assign({ challenge_id: params.challengeId }, "webauthn" in params ? {
                webauthn: Object.assign(Object.assign({}, params.webauthn), { credential_response: params.webauthn.type === "create" ? (0, webauthn_1.serializeCredentialCreationResponse)(params.webauthn.credential_response) : (0, webauthn_1.serializeCredentialRequestResponse)(params.webauthn.credential_response) })
              } : { code: params.code });
              const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/factors/${params.factorId}/verify`, {
                body,
                headers: this.headers,
                jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
              });
              if (error) {
                return this._returnResult({ data: null, error });
              }
              await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + data.expires_in }, data));
              await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", data);
              return this._returnResult({ data, error });
            });
          } catch (error) {
            if ((0, errors_1.isAuthError)(error)) {
              return this._returnResult({ data: null, error });
            }
            throw error;
          }
        });
      }
      async _challenge(params) {
        return this._acquireLock(this.lockAcquireTimeout, async () => {
          try {
            return await this._useSession(async (result) => {
              var _a;
              const { data: sessionData, error: sessionError } = result;
              if (sessionError) {
                return this._returnResult({ data: null, error: sessionError });
              }
              const response = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/factors/${params.factorId}/challenge`, {
                body: params,
                headers: this.headers,
                jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
              });
              if (response.error) {
                return response;
              }
              const { data } = response;
              if (data.type !== "webauthn") {
                return { data, error: null };
              }
              switch (data.webauthn.type) {
                case "create":
                  return {
                    data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: (0, webauthn_1.deserializeCredentialCreationOptions)(data.webauthn.credential_options.publicKey) }) }) }),
                    error: null
                  };
                case "request":
                  return {
                    data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: (0, webauthn_1.deserializeCredentialRequestOptions)(data.webauthn.credential_options.publicKey) }) }) }),
                    error: null
                  };
              }
            });
          } catch (error) {
            if ((0, errors_1.isAuthError)(error)) {
              return this._returnResult({ data: null, error });
            }
            throw error;
          }
        });
      }
      /**
       * {@see GoTrueMFAApi#challengeAndVerify}
       */
      async _challengeAndVerify(params) {
        const { data: challengeData, error: challengeError } = await this._challenge({
          factorId: params.factorId
        });
        if (challengeError) {
          return this._returnResult({ data: null, error: challengeError });
        }
        return await this._verify({
          factorId: params.factorId,
          challengeId: challengeData.id,
          code: params.code
        });
      }
      /**
       * {@see GoTrueMFAApi#listFactors}
       */
      async _listFactors() {
        var _a;
        const { data: { user }, error: userError } = await this.getUser();
        if (userError) {
          return { data: null, error: userError };
        }
        const data = {
          all: [],
          phone: [],
          totp: [],
          webauthn: []
        };
        for (const factor of (_a = user === null || user === void 0 ? void 0 : user.factors) !== null && _a !== void 0 ? _a : []) {
          data.all.push(factor);
          if (factor.status === "verified") {
            ;
            data[factor.factor_type].push(factor);
          }
        }
        return {
          data,
          error: null
        };
      }
      /**
       * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
       */
      async _getAuthenticatorAssuranceLevel(jwt) {
        var _a, _b, _c, _d;
        if (jwt) {
          try {
            const { payload: payload2 } = (0, helpers_1.decodeJWT)(jwt);
            let currentLevel2 = null;
            if (payload2.aal) {
              currentLevel2 = payload2.aal;
            }
            let nextLevel2 = currentLevel2;
            const { data: { user }, error: userError } = await this.getUser(jwt);
            if (userError) {
              return this._returnResult({ data: null, error: userError });
            }
            const verifiedFactors2 = (_b = (_a = user === null || user === void 0 ? void 0 : user.factors) === null || _a === void 0 ? void 0 : _a.filter((factor) => factor.status === "verified")) !== null && _b !== void 0 ? _b : [];
            if (verifiedFactors2.length > 0) {
              nextLevel2 = "aal2";
            }
            const currentAuthenticationMethods2 = payload2.amr || [];
            return { data: { currentLevel: currentLevel2, nextLevel: nextLevel2, currentAuthenticationMethods: currentAuthenticationMethods2 }, error: null };
          } catch (error) {
            if ((0, errors_1.isAuthError)(error)) {
              return this._returnResult({ data: null, error });
            }
            throw error;
          }
        }
        const { data: { session }, error: sessionError } = await this.getSession();
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return {
            data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
            error: null
          };
        }
        const { payload } = (0, helpers_1.decodeJWT)(session.access_token);
        let currentLevel = null;
        if (payload.aal) {
          currentLevel = payload.aal;
        }
        let nextLevel = currentLevel;
        const verifiedFactors = (_d = (_c = session.user.factors) === null || _c === void 0 ? void 0 : _c.filter((factor) => factor.status === "verified")) !== null && _d !== void 0 ? _d : [];
        if (verifiedFactors.length > 0) {
          nextLevel = "aal2";
        }
        const currentAuthenticationMethods = payload.amr || [];
        return { data: { currentLevel, nextLevel, currentAuthenticationMethods }, error: null };
      }
      /**
       * Retrieves details about an OAuth authorization request.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * Returns authorization details including client info, scopes, and user information.
       * If the response includes only a redirect_url field, it means consent was already given - the caller
       * should handle the redirect manually if needed.
       */
      async _getAuthorizationDetails(authorizationId) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/oauth/authorizations/${authorizationId}`, {
              headers: this.headers,
              jwt: session.access_token,
              xform: (data) => ({ data, error: null })
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Approves an OAuth authorization request.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _approveAuthorization(authorizationId, options) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            const response = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
              headers: this.headers,
              jwt: session.access_token,
              body: { action: "approve" },
              xform: (data) => ({ data, error: null })
            });
            if (response.data && response.data.redirect_url) {
              if ((0, helpers_1.isBrowser)() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
                window.location.assign(response.data.redirect_url);
              }
            }
            return response;
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Denies an OAuth authorization request.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _denyAuthorization(authorizationId, options) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            const response = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
              headers: this.headers,
              jwt: session.access_token,
              body: { action: "deny" },
              xform: (data) => ({ data, error: null })
            });
            if (response.data && response.data.redirect_url) {
              if ((0, helpers_1.isBrowser)() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
                window.location.assign(response.data.redirect_url);
              }
            }
            return response;
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Lists all OAuth grants that the authenticated user has authorized.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _listOAuthGrants() {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/user/oauth/grants`, {
              headers: this.headers,
              jwt: session.access_token,
              xform: (data) => ({ data, error: null })
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Revokes a user's OAuth grant for a specific client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _revokeOAuthGrant(options) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, {
              headers: this.headers,
              jwt: session.access_token,
              query: { client_id: options.clientId },
              noResolveJson: true
            });
            return { data: {}, error: null };
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async fetchJwk(kid, jwks = { keys: [] }) {
        let jwk = jwks.keys.find((key) => key.kid === kid);
        if (jwk) {
          return jwk;
        }
        const now = Date.now();
        jwk = this.jwks.keys.find((key) => key.kid === kid);
        if (jwk && this.jwks_cached_at + constants_1.JWKS_TTL > now) {
          return jwk;
        }
        const { data, error } = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, {
          headers: this.headers
        });
        if (error) {
          throw error;
        }
        if (!data.keys || data.keys.length === 0) {
          return null;
        }
        this.jwks = data;
        this.jwks_cached_at = now;
        jwk = data.keys.find((key) => key.kid === kid);
        if (!jwk) {
          return null;
        }
        return jwk;
      }
      /**
       * Extracts the JWT claims present in the access token by first verifying the
       * JWT against the server's JSON Web Key Set endpoint
       * `/.well-known/jwks.json` which is often cached, resulting in significantly
       * faster responses. Prefer this method over {@link #getUser} which always
       * sends a request to the Auth server for each JWT.
       *
       * If the project is not using an asymmetric JWT signing key (like ECC or
       * RSA) it always sends a request to the Auth server (similar to {@link
       * #getUser}) to verify the JWT.
       *
       * @param jwt An optional specific JWT you wish to verify, not the one you
       *            can obtain from {@link #getSession}.
       * @param options Various additional options that allow you to customize the
       *                behavior of this method.
       */
      async getClaims(jwt, options = {}) {
        try {
          let token = jwt;
          if (!token) {
            const { data, error } = await this.getSession();
            if (error || !data.session) {
              return this._returnResult({ data: null, error });
            }
            token = data.session.access_token;
          }
          const { header, payload, signature, raw: { header: rawHeader, payload: rawPayload } } = (0, helpers_1.decodeJWT)(token);
          if (!(options === null || options === void 0 ? void 0 : options.allowExpired)) {
            (0, helpers_1.validateExp)(payload.exp);
          }
          const signingKey = !header.alg || header.alg.startsWith("HS") || !header.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(header.kid, (options === null || options === void 0 ? void 0 : options.keys) ? { keys: options.keys } : options === null || options === void 0 ? void 0 : options.jwks);
          if (!signingKey) {
            const { error } = await this.getUser(token);
            if (error) {
              throw error;
            }
            return {
              data: {
                claims: payload,
                header,
                signature
              },
              error: null
            };
          }
          const algorithm = (0, helpers_1.getAlgorithm)(header.alg);
          const publicKey = await crypto.subtle.importKey("jwk", signingKey, algorithm, true, [
            "verify"
          ]);
          const isValid = await crypto.subtle.verify(algorithm, publicKey, signature, (0, base64url_1.stringToUint8Array)(`${rawHeader}.${rawPayload}`));
          if (!isValid) {
            throw new errors_1.AuthInvalidJwtError("Invalid JWT signature");
          }
          return {
            data: {
              claims: payload,
              header,
              signature
            },
            error: null
          };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
    };
    GoTrueClient.nextInstanceID = {};
    exports.default = GoTrueClient;
  }
});

// node_modules/@supabase/auth-js/dist/main/AuthAdminApi.js
var require_AuthAdminApi = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/AuthAdminApi.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueAdminApi_1 = tslib_1.__importDefault(require_GoTrueAdminApi());
    var AuthAdminApi = GoTrueAdminApi_1.default;
    exports.default = AuthAdminApi;
  }
});

// node_modules/@supabase/auth-js/dist/main/AuthClient.js
var require_AuthClient = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/AuthClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueClient_1 = tslib_1.__importDefault(require_GoTrueClient());
    var AuthClient2 = GoTrueClient_1.default;
    exports.default = AuthClient2;
  }
});

// node_modules/@supabase/auth-js/dist/main/index.js
var require_main3 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.processLock = exports.lockInternals = exports.NavigatorLockAcquireTimeoutError = exports.navigatorLock = exports.AuthClient = exports.AuthAdminApi = exports.GoTrueClient = exports.GoTrueAdminApi = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueAdminApi_1 = tslib_1.__importDefault(require_GoTrueAdminApi());
    exports.GoTrueAdminApi = GoTrueAdminApi_1.default;
    var GoTrueClient_1 = tslib_1.__importDefault(require_GoTrueClient());
    exports.GoTrueClient = GoTrueClient_1.default;
    var AuthAdminApi_1 = tslib_1.__importDefault(require_AuthAdminApi());
    exports.AuthAdminApi = AuthAdminApi_1.default;
    var AuthClient_1 = tslib_1.__importDefault(require_AuthClient());
    exports.AuthClient = AuthClient_1.default;
    tslib_1.__exportStar(require_types2(), exports);
    tslib_1.__exportStar(require_errors(), exports);
    var locks_1 = require_locks();
    Object.defineProperty(exports, "navigatorLock", { enumerable: true, get: function() {
      return locks_1.navigatorLock;
    } });
    Object.defineProperty(exports, "NavigatorLockAcquireTimeoutError", { enumerable: true, get: function() {
      return locks_1.NavigatorLockAcquireTimeoutError;
    } });
    Object.defineProperty(exports, "lockInternals", { enumerable: true, get: function() {
      return locks_1.internals;
    } });
    Object.defineProperty(exports, "processLock", { enumerable: true, get: function() {
      return locks_1.processLock;
    } });
  }
});

// node_modules/@supabase/supabase-js/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  FunctionRegion: () => import_functions_js.FunctionRegion,
  FunctionsError: () => import_functions_js.FunctionsError,
  FunctionsFetchError: () => import_functions_js.FunctionsFetchError,
  FunctionsHttpError: () => import_functions_js.FunctionsHttpError,
  FunctionsRelayError: () => import_functions_js.FunctionsRelayError,
  PostgrestError: () => PostgrestError,
  SupabaseClient: () => SupabaseClient,
  createClient: () => createClient
});
function _typeof3(o) {
  "@babel/helpers - typeof";
  return _typeof3 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof3(o);
}
function toPrimitive3(t, r) {
  if ("object" != _typeof3(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof3(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function toPropertyKey3(t) {
  var i = toPrimitive3(t, "string");
  return "symbol" == _typeof3(i) ? i : i + "";
}
function _defineProperty3(e, r, t) {
  return (r = toPropertyKey3(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function ownKeys4(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread23(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys4(Object(t), true).forEach(function(r$1) {
      _defineProperty3(e, r$1, t[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys4(Object(t)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
    });
  }
  return e;
}
function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}
function applySettingDefaults(options, defaults) {
  var _DEFAULT_GLOBAL_OPTIO, _globalOptions$header;
  const { db: dbOptions, auth: authOptions, realtime: realtimeOptions, global: globalOptions } = options;
  const { db: DEFAULT_DB_OPTIONS$1, auth: DEFAULT_AUTH_OPTIONS$1, realtime: DEFAULT_REALTIME_OPTIONS$1, global: DEFAULT_GLOBAL_OPTIONS$1 } = defaults;
  const result = {
    db: _objectSpread23(_objectSpread23({}, DEFAULT_DB_OPTIONS$1), dbOptions),
    auth: _objectSpread23(_objectSpread23({}, DEFAULT_AUTH_OPTIONS$1), authOptions),
    realtime: _objectSpread23(_objectSpread23({}, DEFAULT_REALTIME_OPTIONS$1), realtimeOptions),
    storage: {},
    global: _objectSpread23(_objectSpread23(_objectSpread23({}, DEFAULT_GLOBAL_OPTIONS$1), globalOptions), {}, { headers: _objectSpread23(_objectSpread23({}, (_DEFAULT_GLOBAL_OPTIO = DEFAULT_GLOBAL_OPTIONS$1 === null || DEFAULT_GLOBAL_OPTIONS$1 === void 0 ? void 0 : DEFAULT_GLOBAL_OPTIONS$1.headers) !== null && _DEFAULT_GLOBAL_OPTIO !== void 0 ? _DEFAULT_GLOBAL_OPTIO : {}), (_globalOptions$header = globalOptions === null || globalOptions === void 0 ? void 0 : globalOptions.headers) !== null && _globalOptions$header !== void 0 ? _globalOptions$header : {}) }),
    accessToken: async () => ""
  };
  if (options.accessToken) result.accessToken = options.accessToken;
  else delete result.accessToken;
  return result;
}
function validateSupabaseUrl(supabaseUrl2) {
  const trimmedUrl = supabaseUrl2 === null || supabaseUrl2 === void 0 ? void 0 : supabaseUrl2.trim();
  if (!trimmedUrl) throw new Error("supabaseUrl is required.");
  if (!trimmedUrl.match(/^https?:\/\//i)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
  try {
    return new URL(ensureTrailingSlash(trimmedUrl));
  } catch (_unused) {
    throw Error("Invalid supabaseUrl: Provided URL is malformed.");
  }
}
function shouldShowDeprecationWarning() {
  if (typeof window !== "undefined") return false;
  const _process = globalThis["process"];
  if (!_process) return false;
  const processVersion = _process["version"];
  if (processVersion === void 0 || processVersion === null) return false;
  const versionMatch = processVersion.match(/^v(\d+)\./);
  if (!versionMatch) return false;
  return parseInt(versionMatch[1], 10) <= 18;
}
var import_functions_js, import_realtime_js, import_auth_js, version2, JS_ENV, DEFAULT_HEADERS2, DEFAULT_GLOBAL_OPTIONS, DEFAULT_DB_OPTIONS, DEFAULT_AUTH_OPTIONS, DEFAULT_REALTIME_OPTIONS, resolveFetch2, resolveHeadersConstructor, fetchWithAuth, SupabaseAuthClient, SupabaseClient, createClient;
var init_dist4 = __esm({
  "node_modules/@supabase/supabase-js/dist/index.mjs"() {
    import_functions_js = __toESM(require_main(), 1);
    init_dist();
    import_realtime_js = __toESM(require_main2(), 1);
    init_dist3();
    import_auth_js = __toESM(require_main3(), 1);
    __reExport(dist_exports, __toESM(require_main2(), 1));
    __reExport(dist_exports, __toESM(require_main3(), 1));
    version2 = "2.99.2";
    JS_ENV = "";
    if (typeof Deno !== "undefined") JS_ENV = "deno";
    else if (typeof document !== "undefined") JS_ENV = "web";
    else if (typeof navigator !== "undefined" && navigator.product === "ReactNative") JS_ENV = "react-native";
    else JS_ENV = "node";
    DEFAULT_HEADERS2 = { "X-Client-Info": `supabase-js-${JS_ENV}/${version2}` };
    DEFAULT_GLOBAL_OPTIONS = { headers: DEFAULT_HEADERS2 };
    DEFAULT_DB_OPTIONS = { schema: "public" };
    DEFAULT_AUTH_OPTIONS = {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "implicit"
    };
    DEFAULT_REALTIME_OPTIONS = {};
    resolveFetch2 = (customFetch) => {
      if (customFetch) return (...args) => customFetch(...args);
      return (...args) => fetch(...args);
    };
    resolveHeadersConstructor = () => {
      return Headers;
    };
    fetchWithAuth = (supabaseKey, getAccessToken, customFetch) => {
      const fetch$1 = resolveFetch2(customFetch);
      const HeadersConstructor = resolveHeadersConstructor();
      return async (input, init) => {
        var _await$getAccessToken;
        const accessToken = (_await$getAccessToken = await getAccessToken()) !== null && _await$getAccessToken !== void 0 ? _await$getAccessToken : supabaseKey;
        let headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
        if (!headers.has("apikey")) headers.set("apikey", supabaseKey);
        if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
        return fetch$1(input, _objectSpread23(_objectSpread23({}, init), {}, { headers }));
      };
    };
    SupabaseAuthClient = class extends import_auth_js.AuthClient {
      constructor(options) {
        super(options);
      }
    };
    SupabaseClient = class {
      /**
      * Create a new client for use in the browser.
      *
      * @category Initializing
      *
      * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
      * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
      * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
      * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
      * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
      * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
      * @param options.realtime Options passed along to realtime-js constructor.
      * @param options.storage Options passed along to the storage-js constructor.
      * @param options.global.fetch A custom fetch implementation.
      * @param options.global.headers Any additional headers to send with each network request.
      *
      * @example Creating a client
      * ```js
      * import { createClient } from '@supabase/supabase-js'
      *
      * // Create a single supabase client for interacting with your database
      * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
      * ```
      *
      * @example With a custom domain
      * ```js
      * import { createClient } from '@supabase/supabase-js'
      *
      * // Use a custom domain as the supabase URL
      * const supabase = createClient('https://my-custom-domain.com', 'publishable-or-anon-key')
      * ```
      *
      * @example With additional parameters
      * ```js
      * import { createClient } from '@supabase/supabase-js'
      *
      * const options = {
      *   db: {
      *     schema: 'public',
      *   },
      *   auth: {
      *     autoRefreshToken: true,
      *     persistSession: true,
      *     detectSessionInUrl: true
      *   },
      *   global: {
      *     headers: { 'x-my-custom-header': 'my-app-name' },
      *   },
      * }
      * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", options)
      * ```
      *
      * @exampleDescription With custom schemas
      * By default the API server points to the `public` schema. You can enable other database schemas within the Dashboard.
      * Go to [Settings > API > Exposed schemas](/dashboard/project/_/settings/api) and add the schema which you want to expose to the API.
      *
      * Note: each client connection can only access a single schema, so the code above can access the `other_schema` schema but cannot access the `public` schema.
      *
      * @example With custom schemas
      * ```js
      * import { createClient } from '@supabase/supabase-js'
      *
      * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key', {
      *   // Provide a custom schema. Defaults to "public".
      *   db: { schema: 'other_schema' }
      * })
      * ```
      *
      * @exampleDescription Custom fetch implementation
      * `supabase-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests,
      * but an alternative `fetch` implementation can be provided as an option.
      * This is most useful in environments where `cross-fetch` is not compatible (for instance Cloudflare Workers).
      *
      * @example Custom fetch implementation
      * ```js
      * import { createClient } from '@supabase/supabase-js'
      *
      * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key', {
      *   global: { fetch: fetch.bind(globalThis) }
      * })
      * ```
      *
      * @exampleDescription React Native options with AsyncStorage
      * For React Native we recommend using `AsyncStorage` as the storage implementation for Supabase Auth.
      *
      * @example React Native options with AsyncStorage
      * ```js
      * import 'react-native-url-polyfill/auto'
      * import { createClient } from '@supabase/supabase-js'
      * import AsyncStorage from "@react-native-async-storage/async-storage";
      *
      * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", {
      *   auth: {
      *     storage: AsyncStorage,
      *     autoRefreshToken: true,
      *     persistSession: true,
      *     detectSessionInUrl: false,
      *   },
      * });
      * ```
      *
      * @exampleDescription React Native options with Expo SecureStore
      * If you wish to encrypt the user's session information, you can use `aes-js` and store the encryption key in Expo SecureStore.
      * The `aes-js` library, a reputable JavaScript-only implementation of the AES encryption algorithm in CTR mode.
      * A new 256-bit encryption key is generated using the `react-native-get-random-values` library.
      * This key is stored inside Expo's SecureStore, while the value is encrypted and placed inside AsyncStorage.
      *
      * Please make sure that:
      * - You keep the `expo-secure-store`, `aes-js` and `react-native-get-random-values` libraries up-to-date.
      * - Choose the correct [`SecureStoreOptions`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestoreoptions) for your app's needs.
      *   E.g. [`SecureStore.WHEN_UNLOCKED`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestorewhen_unlocked) regulates when the data can be accessed.
      * - Carefully consider optimizations or other modifications to the above example, as those can lead to introducing subtle security vulnerabilities.
      *
      * @example React Native options with Expo SecureStore
      * ```ts
      * import 'react-native-url-polyfill/auto'
      * import { createClient } from '@supabase/supabase-js'
      * import AsyncStorage from '@react-native-async-storage/async-storage';
      * import * as SecureStore from 'expo-secure-store';
      * import * as aesjs from 'aes-js';
      * import 'react-native-get-random-values';
      *
      * // As Expo's SecureStore does not support values larger than 2048
      * // bytes, an AES-256 key is generated and stored in SecureStore, while
      * // it is used to encrypt/decrypt values stored in AsyncStorage.
      * class LargeSecureStore {
      *   private async _encrypt(key: string, value: string) {
      *     const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
      *
      *     const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
      *     const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
      *
      *     await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
      *
      *     return aesjs.utils.hex.fromBytes(encryptedBytes);
      *   }
      *
      *   private async _decrypt(key: string, value: string) {
      *     const encryptionKeyHex = await SecureStore.getItemAsync(key);
      *     if (!encryptionKeyHex) {
      *       return encryptionKeyHex;
      *     }
      *
      *     const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
      *     const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
      *
      *     return aesjs.utils.utf8.fromBytes(decryptedBytes);
      *   }
      *
      *   async getItem(key: string) {
      *     const encrypted = await AsyncStorage.getItem(key);
      *     if (!encrypted) { return encrypted; }
      *
      *     return await this._decrypt(key, encrypted);
      *   }
      *
      *   async removeItem(key: string) {
      *     await AsyncStorage.removeItem(key);
      *     await SecureStore.deleteItemAsync(key);
      *   }
      *
      *   async setItem(key: string, value: string) {
      *     const encrypted = await this._encrypt(key, value);
      *
      *     await AsyncStorage.setItem(key, encrypted);
      *   }
      * }
      *
      * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", {
      *   auth: {
      *     storage: new LargeSecureStore(),
      *     autoRefreshToken: true,
      *     persistSession: true,
      *     detectSessionInUrl: false,
      *   },
      * });
      * ```
      *
      * @example With a database query
      * ```ts
      * import { createClient } from '@supabase/supabase-js'
      *
      * const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
      *
      * const { data } = await supabase.from('profiles').select('*')
      * ```
      */
      constructor(supabaseUrl2, supabaseKey, options) {
        var _settings$auth$storag, _settings$global$head;
        this.supabaseUrl = supabaseUrl2;
        this.supabaseKey = supabaseKey;
        const baseUrl = validateSupabaseUrl(supabaseUrl2);
        if (!supabaseKey) throw new Error("supabaseKey is required.");
        this.realtimeUrl = new URL("realtime/v1", baseUrl);
        this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws");
        this.authUrl = new URL("auth/v1", baseUrl);
        this.storageUrl = new URL("storage/v1", baseUrl);
        this.functionsUrl = new URL("functions/v1", baseUrl);
        const defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
        const DEFAULTS = {
          db: DEFAULT_DB_OPTIONS,
          realtime: DEFAULT_REALTIME_OPTIONS,
          auth: _objectSpread23(_objectSpread23({}, DEFAULT_AUTH_OPTIONS), {}, { storageKey: defaultStorageKey }),
          global: DEFAULT_GLOBAL_OPTIONS
        };
        const settings = applySettingDefaults(options !== null && options !== void 0 ? options : {}, DEFAULTS);
        this.storageKey = (_settings$auth$storag = settings.auth.storageKey) !== null && _settings$auth$storag !== void 0 ? _settings$auth$storag : "";
        this.headers = (_settings$global$head = settings.global.headers) !== null && _settings$global$head !== void 0 ? _settings$global$head : {};
        if (!settings.accessToken) {
          var _settings$auth;
          this.auth = this._initSupabaseAuthClient((_settings$auth = settings.auth) !== null && _settings$auth !== void 0 ? _settings$auth : {}, this.headers, settings.global.fetch);
        } else {
          this.accessToken = settings.accessToken;
          this.auth = new Proxy({}, { get: (_, prop) => {
            throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(prop)} is not possible`);
          } });
        }
        this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.global.fetch);
        this.realtime = this._initRealtimeClient(_objectSpread23({
          headers: this.headers,
          accessToken: this._getAccessToken.bind(this)
        }, settings.realtime));
        if (this.accessToken) Promise.resolve(this.accessToken()).then((token) => this.realtime.setAuth(token)).catch((e) => console.warn("Failed to set initial Realtime auth token:", e));
        this.rest = new PostgrestClient(new URL("rest/v1", baseUrl).href, {
          headers: this.headers,
          schema: settings.db.schema,
          fetch: this.fetch,
          timeout: settings.db.timeout,
          urlLengthLimit: settings.db.urlLengthLimit
        });
        this.storage = new StorageClient(this.storageUrl.href, this.headers, this.fetch, options === null || options === void 0 ? void 0 : options.storage);
        if (!settings.accessToken) this._listenForAuthEvents();
      }
      /**
      * Supabase Functions allows you to deploy and invoke edge functions.
      */
      get functions() {
        return new import_functions_js.FunctionsClient(this.functionsUrl.href, {
          headers: this.headers,
          customFetch: this.fetch
        });
      }
      /**
      * Perform a query on a table or a view.
      *
      * @param relation - The table or view name to query
      */
      from(relation) {
        return this.rest.from(relation);
      }
      /**
      * Select a schema to query or perform an function (rpc) call.
      *
      * The schema needs to be on the list of exposed schemas inside Supabase.
      *
      * @param schema - The schema to query
      */
      schema(schema) {
        return this.rest.schema(schema);
      }
      /**
      * Perform a function call.
      *
      * @param fn - The function name to call
      * @param args - The arguments to pass to the function call
      * @param options - Named parameters
      * @param options.head - When set to `true`, `data` will not be returned.
      * Useful if you only need the count.
      * @param options.get - When set to `true`, the function will be called with
      * read-only access mode.
      * @param options.count - Count algorithm to use to count rows returned by the
      * function. Only applicable for [set-returning
      * functions](https://www.postgresql.org/docs/current/functions-srf.html).
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      */
      rpc(fn, args = {}, options = {
        head: false,
        get: false,
        count: void 0
      }) {
        return this.rest.rpc(fn, args, options);
      }
      /**
      * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
      *
      * @param {string} name - The name of the Realtime channel.
      * @param {Object} opts - The options to pass to the Realtime channel.
      *
      */
      channel(name, opts = { config: {} }) {
        return this.realtime.channel(name, opts);
      }
      /**
      * Returns all Realtime channels.
      */
      getChannels() {
        return this.realtime.getChannels();
      }
      /**
      * Unsubscribes and removes Realtime channel from Realtime client.
      *
      * @param {RealtimeChannel} channel - The name of the Realtime channel.
      *
      */
      removeChannel(channel) {
        return this.realtime.removeChannel(channel);
      }
      /**
      * Unsubscribes and removes all Realtime channels from Realtime client.
      */
      removeAllChannels() {
        return this.realtime.removeAllChannels();
      }
      async _getAccessToken() {
        var _this = this;
        var _data$session$access_, _data$session;
        if (_this.accessToken) return await _this.accessToken();
        const { data } = await _this.auth.getSession();
        return (_data$session$access_ = (_data$session = data.session) === null || _data$session === void 0 ? void 0 : _data$session.access_token) !== null && _data$session$access_ !== void 0 ? _data$session$access_ : _this.supabaseKey;
      }
      _initSupabaseAuthClient({ autoRefreshToken, persistSession, detectSessionInUrl, storage, userStorage, storageKey, flowType, lock, debug, throwOnError }, headers, fetch$1) {
        const authHeaders = {
          Authorization: `Bearer ${this.supabaseKey}`,
          apikey: `${this.supabaseKey}`
        };
        return new SupabaseAuthClient({
          url: this.authUrl.href,
          headers: _objectSpread23(_objectSpread23({}, authHeaders), headers),
          storageKey,
          autoRefreshToken,
          persistSession,
          detectSessionInUrl,
          storage,
          userStorage,
          flowType,
          lock,
          debug,
          throwOnError,
          fetch: fetch$1,
          hasCustomAuthorizationHeader: Object.keys(this.headers).some((key) => key.toLowerCase() === "authorization")
        });
      }
      _initRealtimeClient(options) {
        return new import_realtime_js.RealtimeClient(this.realtimeUrl.href, _objectSpread23(_objectSpread23({}, options), {}, { params: _objectSpread23(_objectSpread23({}, { apikey: this.supabaseKey }), options === null || options === void 0 ? void 0 : options.params) }));
      }
      _listenForAuthEvents() {
        return this.auth.onAuthStateChange((event, session) => {
          this._handleTokenChanged(event, "CLIENT", session === null || session === void 0 ? void 0 : session.access_token);
        });
      }
      _handleTokenChanged(event, source, token) {
        if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && this.changedAccessToken !== token) {
          this.changedAccessToken = token;
          this.realtime.setAuth(token);
        } else if (event === "SIGNED_OUT") {
          this.realtime.setAuth();
          if (source == "STORAGE") this.auth.signOut();
          this.changedAccessToken = void 0;
        }
      }
    };
    createClient = (supabaseUrl2, supabaseKey, options) => {
      return new SupabaseClient(supabaseUrl2, supabaseKey, options);
    };
    if (shouldShowDeprecationWarning()) console.warn("\u26A0\uFE0F  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 or later. For more information, visit: https://github.com/orgs/supabase/discussions/37217");
  }
});

// src/lib/supabase.ts
var supabase_exports = {};
__export(supabase_exports, {
  clearUserCache: () => clearUserCache,
  ensureUserId: () => ensureUserId,
  getCurrentUserId: () => getCurrentUserId,
  getSessionWithTimeout: () => getSessionWithTimeout,
  isRealUser: () => isRealUser,
  supabase: () => supabase,
  withUser: () => withUser
});
async function getSessionWithTimeout(ms = 4e3) {
  try {
    return await Promise.race([
      supabase.auth.getSession().then((r) => r.data.session),
      new Promise((resolve) => setTimeout(() => resolve(null), ms))
    ]);
  } catch {
    return null;
  }
}
async function getCurrentUserId() {
  const now = Date.now();
  if (_cachedUserId && now - _cacheTs < _CACHE_TTL) return _cachedUserId;
  try {
    const user = await Promise.race([
      supabase.auth.getUser().then((r) => r.error ? null : r.data.user),
      new Promise((resolve) => setTimeout(() => resolve(null), 4e3))
    ]);
    if (!user) {
      _cachedUserId = null;
      return null;
    }
    _cachedUserId = user.id;
    _cacheTs = now;
    return user.id;
  } catch {
    _cachedUserId = null;
    return null;
  }
}
function clearUserCache() {
  _cachedUserId = null;
  _cacheTs = 0;
}
function isRealUser(user) {
  return !!user && !user.is_anonymous;
}
async function ensureUserId() {
  const existing = await getCurrentUserId();
  if (existing) return existing;
  if (_anonInFlight) return _anonInFlight;
  if (_anonAttempted) return null;
  _anonAttempted = true;
  _anonInFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) return null;
      _cachedUserId = data.user.id;
      _cacheTs = Date.now();
      return data.user.id;
    } catch {
      return null;
    } finally {
      _anonInFlight = null;
    }
  })();
  return _anonInFlight;
}
async function withUser(fn) {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return fn(userId);
}
var supabaseUrl, supabaseAnonKey, supabase, _cachedUserId, _cacheTs, _CACHE_TTL, _anonAttempted, _anonInFlight;
var init_supabase = __esm({
  "src/lib/supabase.ts"() {
    "use strict";
    init_dist4();
    supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use the in-memory promise-chain lock instead of the default Web Locks API
        // (navigator.locks) lock. The navigator lock is keyed on a single name
        // ("lock:sb-…-auth-token") and is meant to coordinate token refresh ACROSS
        // browser tabs — but under React Strict Mode's mount→unmount→mount it gets
        // orphaned, so every getSession()/getUser() then waits 5s for the steal
        // recovery and the loser rejects with `AbortError: Lock broken by another
        // request with the 'steal' option`. Because getSession() sits in the
        // critical path of every proxied LLM call (getAuthHeaders), an orphaned
        // lock froze the whole "session start" with the analysis spinner stuck.
        // processLock is per-JS-context (no cross-tab coordination — acceptable for
        // this localStorage-first SPA) and cannot orphan, which removes the
        // deadlock at the source.
        lock: dist_exports.processLock
      }
    });
    _cachedUserId = null;
    _cacheTs = 0;
    _CACHE_TTL = 6e4;
    _anonAttempted = false;
    _anonInFlight = null;
  }
});

// src/lib/analytics.ts
var analytics_exports = {};
__export(analytics_exports, {
  isAnalyticsHostname: () => isAnalyticsHostname,
  isAnalyticsMetadata: () => isAnalyticsMetadata,
  setAnalyticsUser: () => setAnalyticsUser,
  track: () => track,
  trackError: () => trackError,
  trackLLMCall: () => trackLLMCall,
  trackPageView: () => trackPageView,
  trackTime: () => trackTime
});
function normalizedHostname(value) {
  return value.trim().toLowerCase().replace(/^www\./, "");
}
function isAnalyticsHostname(hostname, siteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  if (!siteUrl) return false;
  try {
    const canonical = new URL(siteUrl).hostname;
    return normalizedHostname(hostname) === normalizedHostname(canonical);
  } catch {
    return false;
  }
}
function isAnalyticsMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
}
function getSessionId() {
  if (_sessionId) return _sessionId;
  if (typeof window === "undefined") return "ssr";
  _sessionId = sessionStorage.getItem("ov_sid") || crypto.randomUUID();
  sessionStorage.setItem("ov_sid", _sessionId);
  return _sessionId;
}
function getSessionMeta() {
  if (_sessionMeta) return _sessionMeta;
  if (typeof window === "undefined") return {};
  _sessionMeta = {
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dark_mode: document.documentElement.getAttribute("data-theme") === "dark",
    lang: navigator.language,
    touch: "ontouchstart" in window,
    returning: !!localStorage.getItem("ov_returning")
  };
  localStorage.setItem("ov_returning", "1");
  return _sessionMeta;
}
function getSourceMeta() {
  if (typeof window === "undefined") return {};
  const cached = sessionStorage.getItem("ov_src");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (!isAnalyticsMetadata(parsed)) throw new Error("Invalid analytics metadata cache");
      return {
        ...parsed,
        app_host: window.location.hostname,
        analytics_environment: "production"
      };
    } catch {
    }
  }
  const params = new URLSearchParams(window.location.search);
  const meta = {
    app_host: window.location.hostname,
    analytics_environment: "production",
    initial_referrer: document.referrer || null,
    initial_path: window.location.pathname,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
    utm_term: params.get("utm_term"),
    ref: params.get("ref"),
    // generic community/share tag
    fbclid: params.get("fbclid"),
    gclid: params.get("gclid"),
    // Google Ads
    msclkid: params.get("msclkid"),
    // Microsoft Ads
    ttclid: params.get("ttclid"),
    // TikTok
    li_fat_id: params.get("li_fat_id")
    // LinkedIn
  };
  for (const k of Object.keys(meta)) if (meta[k] == null) delete meta[k];
  sessionStorage.setItem("ov_src", JSON.stringify(meta));
  return meta;
}
function setAnalyticsUser(userId) {
  const previous = _userId;
  _userId = userId;
  if (userId && !previous && typeof window !== "undefined") {
    track("user_identified", {});
  }
}
function maybeEmitSessionStart() {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem("ov_sst") === "1") return;
  sessionStorage.setItem("ov_sst", "1");
  track("session_start", getSourceMeta());
}
function track(event, properties) {
  if (typeof window === "undefined") return;
  if (!isAnalyticsHostname(window.location.hostname)) return;
  if (event !== "session_start") maybeEmitSessionStart();
  const row = {
    event_name: event,
    properties: { ...getSessionMeta(), ...properties },
    session_id: getSessionId(),
    user_id: _userId,
    page_path: window.location.pathname + window.location.search,
    referrer: document.referrer || null
  };
  try {
    Promise.resolve().then(() => (init_supabase(), supabase_exports)).then(async ({ supabase: supabase2 }) => {
      const { error } = await supabase2.from("user_events").insert(row);
      if (error) reportSyncFailure("analytics", { surface: false });
    }).catch(() => {
    });
  } catch {
  }
}
function trackTime(event, properties) {
  const start = Date.now();
  return () => {
    track(event, { ...properties, duration_ms: Date.now() - start });
  };
}
function trackPageView(path) {
  track("page_view", { path: path || window.location.pathname });
}
async function trackLLMCall(step, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    track("llm_call", { step, duration_ms: Date.now() - start, success: true });
    return result;
  } catch (err) {
    track("llm_call", { step, duration_ms: Date.now() - start, success: false, error: err instanceof Error ? err.message : "unknown" });
    throw err;
  }
}
function trackError(context, error) {
  track("error", {
    context,
    message: error instanceof Error ? error.message : String(error)
  });
}
var _sessionId, _sessionMeta, _userId;
var init_analytics = __esm({
  "src/lib/analytics.ts"() {
    init_sync_health();
    _sessionId = null;
    _sessionMeta = null;
    _userId = null;
  }
});

// src/lib/light-path/light-engine.ts
init_analytics();
import { callLLMJson } from "../llm-shim.mjs";

// src/lib/crisis-gate.ts
var PATTERNS = [
  {
    category: "self_harm",
    res: [
      /\bno\s+point\s+(to\b|in\b|anymore)/i,
      /\bstop\s+trying\s+with\s+everything\b/i,
      /won['’]?t\s+be\s+needing\b/i,
      /make\s+sure\s+my\s+family\s+won['’]?t\s+have\s+to\s+deal\s+with\s+me/i,
      /\b(end\s+(it|things|my\s+life)|not\s+come\s+back|disappear\s+so)\b/i,
      /drive\s+(somewhere\s+far\s+)?and\s+not\s+come\s+back/i,
      /\b(kill\s+myself|suicid|self[-\s]?harm)\b/i,
      /(죽고\s*싶|자살|자해|사라지고\s*싶|목숨을?\s*끊|살\s*이유가?\s*없|살고\s*싶지\s*않)/,
      // 완곡어 (sim F1, heavy-09): 빚/채무 맥락의 "(그냥) 다/전부 정리해버리다" —
      // 재정 파탄 화면에서 흔한 자해 완곡 표현. 채무 앵커 없이 "책상 다 정리"류는
      // 잡지 않는다 (정밀 우선). 활용형(버릴까/버렸/버려)은 조합 음절이라 '버리'
      // 리터럴로는 못 잡는다 — 음절 클래스로 매칭 (플러그인 낱자모 죽은 규칙 교훈).
      /(빚|채무|대출|이자).{0,60}(그냥\s*)?(다|전부|모두|싹)\s*정리해\s*버[리려렸릴린]/
    ]
  },
  {
    category: "dangerous_medical",
    res: [
      /stop\s+(taking\s+)?(my\s+)?(insulin|medication|meds)\b/i,
      /refuse\s+(the\s+)?chemo/i,
      /\bcold\s+turkey\b/i,
      /(drop|down)\s+to\s+\d{2,3}\s+calor/i,
      /\b[2-9]00\s+calories\s+a\s+day\b/i,
      /(인슐린|약).{0,6}(끊|중단)|항암.{0,6}(거부|안\s*받)/
    ]
  },
  {
    category: "abuse_coercion",
    res: [
      /only\s+(gets?\s+(physical|violent)|hits?\s+me)\s+when\s+I\s+(provoke|deserve)/i,
      /if\s+I\s+really\s+loved\s+(him|her|them).{0,50}(quit|stop\s+seeing|give\s+up)/i,
      /(때리|폭행|학대).{0,12}(내가|제가).{0,12}(자극|잘못)/
    ]
  },
  {
    category: "legal_jeopardy",
    res: [
      /take\s+the\s+kids?\s+and\s+leave\s+(the\s+)?(state|country|town)/i,
      /before\s+the\s+custody\s+hearing.{0,40}without\s+telling/i,
      // KO (sim F1 정적 감사: 이 카테고리는 한국어 패턴 0개였다 — 주 사용 언어가
      // 한국어인 제품의 백스톱이 영어에 편향). EN 패턴의 거울: 양육권 절차 앞의
      // 은닉 이동만 — 평범한 양육권 상담은 잡지 않는다 (정밀 우선).
      /(양육권|친권).{0,30}(소송|재판|심판|심리|조정).{0,40}(몰래|말\s*없이|숨기)/,
      /(아이|애들?|자녀)\s*(를|들을)?\s*데리고.{0,30}(몰래|말\s*없이).{0,30}(떠나|이사|출국|가\s*버리)/
    ]
  },
  {
    category: "financial_ruin",
    res: [
      // Total-stake phrase + speculative signal, both required (precision). Broadened
      // so "life savings ... 50x" and "all my savings ... guaranteed" fire too, not
      // just "401k ... 100x" (F20). \d{2,3}x covers 20x/50x/100x. Split savings vs
      // 401k/retirement so the optional "my" doesn't double-require a space.
      /(life|all\s+(of\s+)?(my\s+)?|entire|whole|my\s+(life|entire))\s*savings\b.{0,45}(crypto|coin|meme|\d{2,3}x|guaranteed)/i,
      /(entire|whole|all\s+(of\s+)?(my\s+)?|my)\s*(401k|retirement)\b.{0,45}(crypto|coin|meme|\d{2,3}x|guaranteed)/i,
      /second\s+mortgage.{0,30}(crypto|coin|bet|\d{2,3}x)/i,
      // KO (sim F1): 전 재산급 판돈 + 투기 신호의 2중 요건 — EN과 같은 정밀 편향.
      // "주식 조금 사볼까" 같은 일상 투자 결정은 판돈 앵커가 없어 잡히지 않는다.
      /(전\s*재산|전세\s*(보증)?금|노후\s*자금|퇴직금).{0,40}(코인|크립토|가상\s*화폐|주식|선물|레버리지|몰빵|올인)/,
      /(대출|빚)\s*(을|를)?\s*(내서|받아서|끌어다|당겨서).{0,30}(코인|주식|선물|도박)/,
      /(집|아파트)\s*담보.{0,30}(코인|주식|도박)/
    ]
  },
  {
    category: "minor_at_risk",
    res: [
      /\bi['’ ]?a?m\s+1[0-7]\b/i,
      // An online stranger + a meeting, in EITHER order and varied phrasing (F19).
      // The online-stranger anchor is kept on purpose — a bare "meet"/"come over"
      // with no stranger signal would over-fire on any adult (the mirror clause).
      /(meet|see)\s+(up\s+with\s+)?(a\s+)?(guy|man|girl|person)\s+I\s+met\s+online/i,
      /(guy|man|girl|person|someone)\s+(I\s+)?(met\s+)?online\b.{0,50}(wants?\s+(to\s+)?(meet|see)|come\s+over|meet\s+up|see\s+me)/i,
      /(meet\s+up|come\s+over|meet|see)\b.{0,40}(guy|man|girl|person|someone)\b.{0,20}(from|met)\s+online/i,
      // KO (sim F1 정적 감사). EN과 같은 앵커: 미성년 자기 선언, 또는 온라인에서
      // 만난 낯선 사람 + 만남 제안. 앵커 없는 일상 약속은 잡지 않는다.
      /(저|전|나)\s*(이제\s*)?1[0-7]\s*살인데/,
      /(인터넷|온라인|채팅|앱|게임)에서\s*만난\s*(사람|남자|여자|오빠|형|언니|누나).{0,40}(만나자|만나기로|보자|보재|오라|나오라|나오래)/
    ]
  },
  {
    category: "irreversible_harm_to_others",
    res: [
      /send(ing)?\s+the\s+(private\s+)?(screenshots?|photos?|nudes?|messages?|pictures?)\b.{0,60}(coworkers?|family|everyone|all\s+(her|his|their))/i,
      /\b(revenge\s+porn|expose\s+(her|him|them)\s+to\s+(everyone|all))\b/i,
      // KO (sim F1 정적 감사). EN의 거울: 사적 자료 + 유포 의도. 복수 의도가
      // 명확한 동사(유포/뿌리/퍼뜨리/폭로/박제)만 — "사진 보내달래"류는 제외.
      /(전\s*남친|전\s*여친|전\s*남편|전\s*아내|헤어진\s*(남친|여친|애인)).{0,40}(사진|영상|캡처|대화\s*내용).{0,30}(유포|뿌리|퍼뜨리|폭로|박제)/,
      /(나체|알몸|은밀한)\s*(사진|영상).{0,30}(회사|가족|지인|단톡|모두에게|다\s*보내|뿌리)/
    ]
  }
];
function classifyCrisis(text) {
  const t = (text || "").trim();
  if (!t) return { isCrisis: false };
  for (const group of PATTERNS) {
    for (const re of group.res) {
      const m = t.match(re);
      if (m) return { isCrisis: true, category: group.category, matched: m[0] };
    }
  }
  return { isCrisis: false };
}
var CONCERN = {
  self_harm: {
    ko: "\uC774\uAC74 \uACB0\uC815 \uB3C4\uAD6C\uAC00 \uC544\uB2C8\uB77C \uC0AC\uB78C\uC774 \uD568\uAED8\uD574\uC57C \uD560 \uC21C\uAC04\uC73C\uB85C \uBCF4\uC5EC\uC694. \uD55C\uAD6D \uC790\uC0B4\uC608\uBC29\uC0C1\uB2F4 109(24\uC2DC\uAC04)\uC5D0 \uB2FF\uC744 \uC218 \uC788\uC5B4\uC694. \uC6D0\uD558\uBA74 \uACC4\uC18D \uC774\uC57C\uAE30\uD574\uB3C4 \uB3FC\uC694.",
    en: "This reads like a moment for a person, not a decision tool. In the US you can reach 988 (call or text), any time. I'm still here if you want to keep talking."
  },
  dangerous_medical: {
    ko: "\uC774\uAC74 \uC758\uD559\uC801\uC73C\uB85C \uC704\uD5D8\uD560 \uC218 \uC788\uC5B4\uC11C, \uD56D\uD574\uB85C \uB2E4\uB8E8\uAE30 \uC804\uC5D0 \uC758\uB8CC\uC9C4\uACFC \uBA3C\uC800 \uD655\uC778\uD558\uB294 \uAC8C \uB9DE\uC544 \uBCF4\uC5EC\uC694.",
    en: "This could be medically dangerous \u2014 worth confirming with a clinician before treating it as a navigable plan."
  },
  abuse_coercion: {
    ko: "\uC5EC\uAE30\uC5D4 \uC548\uC804\uC774 \uAC78\uB824 \uC788\uC744 \uC218 \uC788\uC5B4\uC694. \uD55C\uAD6D \uC5EC\uC131\uAE34\uAE09\uC804\uD654 1366(24\uC2DC\uAC04)\uC5D0 \uB2FF\uC744 \uC218 \uC788\uACE0, \uC6D0\uD558\uBA74 \uC774\uC57C\uAE30 \uB4E4\uC744\uAC8C\uC694.",
    en: "There may be safety at stake here. In the US the DV hotline is 1-800-799-7233, any time. I can also just listen."
  },
  legal_jeopardy: {
    ko: "\uC774\uAC74 \uBC95\uC801 \uC704\uD5D8\uC774 \uD070 \uC120\uD0DD\uC774\uB77C, \uC9C4\uD589 \uC804\uC5D0 \uBCC0\uD638\uC0AC\uC640 \uBA3C\uC800 \uC9DA\uB294 \uAC8C \uC548\uC804\uD574 \uBCF4\uC5EC\uC694.",
    en: "This carries real legal jeopardy \u2014 worth a lawyer before acting, not a planning exercise."
  },
  financial_ruin: {
    ko: "\uB418\uB3CC\uB9AC\uAE30 \uC5B4\uB824\uC6B4 \uADDC\uBAA8\uC758 \uC7AC\uC815 \uACB0\uC815\uC774\uC5D0\uC694. \uD56D\uD574\uB85C \uC9DC\uAE30 \uC804\uC5D0 \uADF8 \uBE44\uAC00\uC5ED\uC131\uBD80\uD130 \uAC19\uC774 \uBCFC\uAE4C\uC694?",
    en: "This is a hard-to-reverse, all-in financial move \u2014 worth sitting with the irreversibility before any plan."
  },
  minor_at_risk: {
    ko: "\uC548\uC804\uC774 \uC6B0\uC120\uC774\uC5D0\uC694 \u2014 \uBBFF\uC744 \uC218 \uC788\uB294 \uC5B4\uB978\uC774\uB098 \uB3C4\uC6C0\uBC1B\uC744 \uACF3\uACFC \uBA3C\uC800 \uC774\uC57C\uAE30\uD558\uBA74 \uC88B\uACA0\uC5B4\uC694.",
    en: "Your safety comes first here \u2014 please talk to a trusted adult or a help line before anything else."
  },
  irreversible_harm_to_others: {
    ko: "\uC774\uAC74 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uACE0 \uB2E4\uB978 \uC0AC\uB78C\uC5D0\uAC8C \uD070 \uC601\uD5A5\uC744 \uC918\uC694. \uBCF4\uB0B4\uAE30 \uC804\uC5D0 \uC7A0\uAE50 \uBA48\uCDB0\uC11C \uAC19\uC774 \uBCFC\uAE4C\uC694?",
    en: "This is irreversible and lands hard on another person \u2014 worth a pause before sending, not a how-to."
  }
};
function formatConcernMessage(category, locale = "ko") {
  return CONCERN[category][locale];
}

// src/lib/progressive-guards.ts
function lowConfidenceOpeningCopy(locale) {
  return locale === "ko" ? { question: { text: "\uC774 \uC0C1\uD669\uC5D0\uC11C \uC9C0\uAE08 \uAC00\uC7A5 \uB9C8\uC74C\uC5D0 \uAC78\uB9AC\uB294 \uAC74 \uBB50\uC608\uC694?", type: "short", options: [] } } : { question: { text: "What feels most unresolved about this situation right now?", type: "short", options: [] } };
}
var ENGLISH_FILLER = /* @__PURE__ */ new Set([
  "about",
  "there",
  "their",
  "would",
  "could",
  "should",
  "think",
  "thinking",
  "really",
  "going",
  "other",
  "because",
  "which",
  "where",
  "while",
  "still",
  "thing",
  "things",
  "something",
  "anything",
  "better",
  "right",
  "maybe",
  "whether",
  "between",
  "these",
  "those",
  "being",
  "having",
  "doing",
  "over",
  "more",
  "much",
  "them",
  "that",
  "this",
  "with",
  "from",
  "want",
  "need",
  "know",
  "like",
  "just",
  "been",
  "have",
  "what",
  "when",
  "they",
  "some"
]);
function questionEchoesUser(questionText, userText) {
  const q = (questionText || "").normalize("NFKC").toLocaleLowerCase();
  const u = (userText || "").normalize("NFKC").toLocaleLowerCase();
  if (!q || !u) return false;
  if (/[가-힣]/.test(u)) {
    const strip = (s) => s.replace(/[^가-힣0-9a-z]/g, "");
    const su = strip(u);
    const sq = strip(q);
    for (let i = 0; i + 4 <= su.length; i += 1) {
      if (sq.includes(su.slice(i, i + 4))) return true;
    }
    return false;
  }
  const content = (u.match(/[a-z][a-z']{3,}/g) || []).filter((w) => !ENGLISH_FILLER.has(w));
  return content.some((w) => new RegExp(`\\b${w}`, "i").test(q));
}
function questionManufacturesFork(text, options, userText) {
  void options;
  const t = text || "";
  const forked = /아니면|,\s*또는|\b(?:or)\b/i.test(t) || /(가요|나요|까요|예요|이에요)\s*[,，]\s*[^,，]{2,}(가요|나요|까요|예요|이에요)/.test(t);
  return forked && !questionEchoesUser(t, userText);
}
function dropManufacturedFork(question, userCorpus) {
  if (!question?.text) return null;
  return questionManufacturesFork(question.text, question.options, userCorpus) ? null : question;
}
function guardLowConfidenceOpeningQuestion(question, problemText, locale) {
  if (question?.text && !questionManufacturesFork(question.text, question.options, problemText)) {
    const chips = (question.options || []).filter((o) => typeof o === "string" && !!o.trim()).filter((o) => questionEchoesUser(o, problemText));
    if (chips.length === (question.options || []).length) return question;
    return chips.length >= 2 ? { ...question, options: chips } : { ...question, options: void 0, type: "short" };
  }
  const open = lowConfidenceOpeningCopy(locale).question;
  return question ? { ...question, ...open, subtext: void 0 } : open;
}
function ensureCrisisResource(insight, locale) {
  const resource = formatConcernMessage("self_harm", locale === "ko" ? "ko" : "en");
  const text = (insight || "").trim();
  if (!text) return resource;
  if (/109|988|1366|1[-.\s]?800/.test(text)) return text;
  return `${text}

${resource}`;
}
function stripConditionalReassurance(insight) {
  if (!insight) return insight;
  const COND = /(없다면|없으면|된다면|이라면|아니라면)[^.!?…\n]*(걸림돌|문제(는|가|도)?\s*(없|아니)|괜찮|지장(은|이)?\s*없|무리(는|가)?\s*없|진행해도\s*돼)/;
  const sentences = insight.split(/(?<=[.!?…])\s+/);
  const kept = sentences.filter((s) => !COND.test(s));
  const out = kept.join(" ").trim();
  return out || insight;
}
var WORD_CHOICE_READING = new RegExp(
  // '이나'가 붙은 거 / "여행이나"라고 쓰신 걸 보면 / 그 표현을 보면
  `['"\u201C\u201D\u2018\u2019][^'"\u201C\u201D\u2018\u2019]{1,20}['"\u201C\u201D\u2018\u2019]\\s*(\uAC00|\uC774|\uC744|\uB97C|\uB77C\uACE0|\uC774\uB77C\uACE0)?\\s*(\uBD99|\uC4F0|\uC801|\uB9D0\uC500|\uD558\uC2E0|\uD55C \uAC83|\uD55C \uAC70)|(\uD45C\uD604|\uB9D0\uD22C|\uB2E8\uC5B4|\uC5B4\uD22C|\uB9D0\uC528|\uC5B4\uAC10|\uB258\uC559\uC2A4)\\s*(\uC744|\uB97C|\uC774|\uAC00|\uC5D0\uC11C)?\\s*\uBCF4\uBA74|(\uD45C\uD604|\uB9D0\uD22C|\uB2E8\uC5B4|\uC5B4\uD22C|\uB9D0\uC528|\uC5B4\uAC10|\uB258\uC559\uC2A4)(\uC744|\uB97C|\uC774|\uAC00)?\\s*(\uC4F0\uC2E0|\uACE0\uB974\uC2E0|\uD0DD\uD558\uC2E0|\uC120\uD0DD\uD558\uC2E0)|\uB77C\uACE0\\s*(\uD558\uC2E0|\uC4F0\uC2E0|\uB9D0\uC500\uD558\uC2E0)\\s*(\uAC70|\uAC83|\uAC78|\uC810)|\\b(the way you (put|said|phrased)|your (word|phrasing|wording) (choice )?(suggests|tells|says))\\b`,
  "i"
);
var FRAME_SEIZURE = new RegExp(
  // Two shapes, both narrow. Nominalised — "고민하는 게 아니라" — and
  // subject-negated — "질문이 그게 아니라". In the second the particle has to
  // sit directly on the noun, so "선택지가 두 개가 아니라" (an ordinary factual
  // correction) does not match.
  `(\uACE0\uBBFC|\uC9C8\uBB38|\uACB0\uC815|\uC120\uD0DD|\uD310\uB2E8|\uBB3B\uACE0|\uC815\uD558)[\uAC00-\uD7A3]*\\s*(\uAC8C|\uAC83\uC774|\uAC83\uB3C4|\uBB38\uC81C\uAC00|\uBB38\uC81C\uB294|\uC77C\uC774)\\s*\uC544\uB2C8\uB77C|(\uACE0\uBBFC|\uC9C8\uBB38|\uACB0\uC815|\uC120\uD0DD|\uD310\uB2E8)(\uC774|\uAC00|\uC740|\uB294)\\s*[\uAC00-\uD7A3\\s]{0,6}\uC544\uB2C8\uB77C|['"\u201C\u201D\u2018\u2019][^'"\u201C\u201D\u2018\u2019]{1,24}['"\u201C\u201D\u2018\u2019]\\s*(\uC744|\uB97C|\uC774|\uAC00|\uC740|\uB294)?\\s*[\uAC00-\uD7A3\\s]{0,12}\uC544\uB2C8\uB77C|(\uC9C4\uC9DC|\uC0AC\uC2E4|\uD575\uC2EC|\uBCF8\uC9C8\uC801\uC778|\uC2E4\uC81C)\\s*(\uC9C8\uBB38|\uBB38\uC81C|\uACE0\uBBFC)(\uC740|\uB294|\uC774)|\\b(the real question is|what you.?re (actually|really) (deciding|asking)|it.?s not (really )?about)\\b`,
  "i"
);
function normalizeQuestionForRepeat(text) {
  return text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
function questionBigramSimilarity(a, b) {
  const left = Array.from(normalizeQuestionForRepeat(a));
  const right = Array.from(normalizeQuestionForRepeat(b));
  if (left.length < 12 || right.length < 12) return 0;
  const counts = /* @__PURE__ */ new Map();
  for (let i = 0; i < left.length - 1; i += 1) {
    const gram = `${left[i]}${left[i + 1]}`;
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < right.length - 1; i += 1) {
    const gram = `${right[i]}${right[i + 1]}`;
    const count = counts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return 2 * overlap / (left.length - 1 + (right.length - 1));
}
function dropRepeatedQuestion(question, previouslyAsked) {
  if (!question?.text) return question ?? null;
  const normalized = normalizeQuestionForRepeat(question.text);
  if (!normalized) return null;
  return previouslyAsked.some((text) => normalizeQuestionForRepeat(text) === normalized || questionBigramSimilarity(text, question.text || "") >= 0.28) ? null : question;
}
var ESCALATION_MARKER = /'더 깊이 보기'를 직접 선택|chose to open this question up/;
function capEscalationArrival(result, problemText) {
  if (!ESCALATION_MARKER.test(problemText || "")) return result;
  return { ...result, hidden_assumptions: (result.hidden_assumptions || []).slice(0, 1) };
}
var HEAVY_VOCAB_SWAPS = [
  [/베팅/g, "\uD310\uB2E8"],
  // '밑그림' was a rejected vocabulary candidate — the ratified scheme is the
  // 정리 axis (founder ruling 2026-07-31), so model-emitted 초안 becomes 정리.
  [/초안/g, "\uC815\uB9AC"]
];
function scrubBannedVocabulary(text) {
  let out = text || "";
  for (const [re, sub] of HEAVY_VOCAB_SWAPS) out = out.replace(re, sub);
  return out;
}
function scrubList(items) {
  return (items || []).map((s) => scrubBannedVocabulary(s));
}

// src/lib/persona-prompt.ts
function sanitizeForPrompt(text) {
  if (!text) return "";
  return text.replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/\[\/?\s*(?:SYSTEM|END|INST|USER|ASSISTANT|CONTEXT)[^\]]*\]/gi, "").replace(/\b(?:ignore|disregard|forget|override)\s+(?:all\s+|the\s+|any\s+|every\s+)?(?:previous|above|prior|earlier|preceding|the\s+above)\s+(?:instructions?|prompts?|messages?|context|directions?|rules?)/gi, "").replace(/\b(?:new\s+)?system\s+prompt\s*:/gi, "").replace(/(?:이전|위|앞|상기|모든)\s*(?:의)?\s*(?:지시|명령|지침|프롬프트|규칙)\s*(?:사항)?\s*(?:을|를|은|는)?\s*(?:다|모두)?\s*(?:무시|무효화?|잊어?(?:버려)?)/g, "").replace(/무시하?(?:고|라|세요|해)\s*(?:다음|아래|이제|이것|위)/g, "").replace(/[\r\n]+/g, " ").replace(/\s{3,}/g, "  ").trim();
}

// src/lib/decision-contract.ts
var PROMPT_VERSION = "r60-2026-06";
var APP_VERSION = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_VERSION || PROMPT_VERSION;
var DAY_MS = 864e5;
var CHECK_IN_MS = {
  "1d": 1 * DAY_MS,
  "3d": 3 * DAY_MS,
  "1w": 7 * DAY_MS,
  "2w": 14 * DAY_MS,
  "1m": 30 * DAY_MS
};

// src/lib/light-path/light-engine.ts
var LIGHT_MAX_QUESTIONS = 2;
var LIGHT_DAYS_MIN = 1;
var LIGHT_DAYS_MAX = 14;
var LIGHT_RULES_KO = `\uB2F9\uC2E0\uC740 Argus \u2014 \uD310\uB2E8\uC744 \uBE44\uCD94\uB294 \uAC70\uC6B8\uC785\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uAC00 \uC77C\uC0C1\uC758 \uACB0\uC815\uC744 \uD55C \uC904 \uB358\uC84C\uC2B5\uB2C8\uB2E4.

\uC808\uB300 \uADDC\uCE59:
1. \uB2FB: \uC0AC\uC6A9\uC790\uC758 \uC0C1\uD669\uC774\uB77C\uACE0 \uB9D0\uD560 \uC218 \uC788\uB294 \uAC83\uC740 \uC0AC\uC6A9\uC790\uAC00 \uC2E4\uC81C\uB85C \uC4F4 \uAC83\uBFD0\uC785\uB2C8\uB2E4. \uC548 \uD55C \uB9D0\uC744 \uC0C1\uD669\uC73C\uB85C \uB9CC\uB4E4\uC9C0 \uB9C8\uC138\uC694 (\uC608: '\uD30C\uD2F0'\uC5D0\uC11C '\uC220'\uC744 \uC5F0\uC0C1\uD574 \uC5B8\uAE09\uD558\uB294 \uAC83 \uAE08\uC9C0). \uBAA8\uB974\uB294 \uAC83\uC740 \uBAA8\uB978\uB2E4\uACE0 \uB9D0\uD558\uAC70\uB098 \uC9C8\uBB38\uD558\uC138\uC694.
   \uC2DC\uC81C\xB7\uC9C4\uD589 \uC0C1\uD0DC\uB3C4 \uC4F4 \uADF8\uB300\uB85C\uB9CC \u2014 \uBC18\uB300 \uC0C1\uD0DC\uB098 \uC548 \uC4F4 \uC0C1\uD0DC\uB97C \uB2E8\uC815\uD558\uC9C0 \uB9C8\uC138\uC694. \uBAA8\uD638\uD558\uBA74 \uBAA8\uB978\uB2E4\uACE0 \uD558\uC138\uC694.
   \u2717 (\uC0C1\uD0DC\uB97C \uC548 \uBC1D\uD614\uB294\uB370) "\uC544\uC9C1 \uD30C\uD2F0\uAC00 \uB05D\uB098\uC9C0 \uC54A\uC740 \uAC70\uB124\uC694" \u2713 "\uC9C0\uAE08\uC774 \uD30C\uD2F0 \uC911\uC778\uC9C0 \uB05D\uB09C \uB4A4\uC778\uC9C0\uB294 \uC548 \uC4F0\uC168\uACE0\uC694"
   \uC0AC\uC2E4\uC5D0\uC11C \uAE30\uC6B8\uAE30\uB97C \uCD94\uB860\uD558\uC9C0\uB3C4 \uB9C8\uC138\uC694 \u2014 \uC0AC\uC2E4\uC740 \uBE44\uCD94\uACE0, \uB9C8\uC74C\uC740 \uBB3C\uC5B4\uC57C \uD569\uB2C8\uB2E4.
   \u2717 "\uB0B4\uC77C \uC544\uCE68 \uC77C\uCC0D \uC77C\uC5B4\uB098\uC57C \uD574\uC11C \uC9D1 \uAC00\uB294 \uCABD\uC73C\uB85C \uAE30\uC6B8\uC5B4\uC838 \uC788\uB294 \uAC70\uB124\uC694" \u2713 "\uB0B4\uC77C \uC77C\uCC0D \uC77C\uC5B4\uB098\uC57C \uD558\uB294 \uC0C1\uD669\uC774\uACE0\uC694 \u2014 \uB9C8\uC74C\uC774 \uC5B4\uB290 \uCABD\uC778\uC9C0\uB294 \uC544\uC9C1 \uC548 \uB4E4\uC5C8\uC5B4\uC694"
2. \uD310\uC815 \uAE08\uC9C0: \uC5B4\uB290 \uCABD\uC774 \uB0AB\uB2E4\uACE0 \uB9D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uACB0\uC815\uC744 \uAC00\uB974\uB294 \uBCC0\uC218 \uD558\uB098\uB97C \uC774\uB984 \uBD99\uC5EC \uB3CC\uB824\uC904 \uBFD0\uC785\uB2C8\uB2E4.
   \uC0AC\uC6A9\uC790\uAC00 \uC2A4\uC2A4\uB85C \uBB34\uAC8C\uB97C \uC815\uD588\uC73C\uBA74 \uADF8 \uC800\uC6B8\uC740 \uADF8\uB300\uB85C \uB461\uB2C8\uB2E4. \uB0B4\uB824\uB193\uC740 \uCABD\uC744 \uB2E4\uC2DC \uB4E4\uC5B4\uC62C\uB9AC\uC9C0 \uB9C8\uC138\uC694.
   \u2717 (\uC2E4\uCE21) \uC0AC\uC6A9\uC790 "\uD53C\uACE4\uD55C \uCABD\uC774 \uB354 \uCEE4" \u2192 "\uADF8\uB798\uB3C4 \uB0A8\uD3B8\uC774 \uB2A6\uAC8C\uAE4C\uC9C0 \uC788\uACE0 \uC2F6\uC740 \uB208\uCE58\uB77C\uB294 \uAC8C \uAC78\uB9AC\uC2DC\uB294 \uAC70\uACE0\uC694."
      \uBCF8\uC778\uC774 \uC5B4\uB290 \uCABD\uC774 \uD070\uC9C0 \uB9D0\uD588\uB294\uB370 \uBC18\uB300\uCABD\uC744 \uB2E4\uC2DC \uC5B9\uC5C8\uC2B5\uB2C8\uB2E4. \uADE0\uD615\uC744 \uB9DE\uCD94\uB294 \uAC8C \uC911\uB9BD\uC774 \uC544\uB2C8\uB77C,
      \uADF8 \uC0AC\uB78C\uC774 \uB9E4\uAE34 \uBB34\uAC8C\uB97C \uAC74\uB4DC\uB9AC\uC9C0 \uC54A\uB294 \uAC8C \uC911\uB9BD\uC785\uB2C8\uB2E4.
   \u2713 "\uD53C\uACE4\uD55C \uCABD\uC774 \uD655\uC2E4\uD788 \uD06C\uC2E0 \uAC70\uB124\uC694. \uB0A8\uD3B8\uBD84\uD55C\uD14C\uB294 \uC544\uC9C1 \uC598\uAE30 \uC548 \uD574\uBCF4\uC2E0 \uAC70\uACE0\uC694."
3. \uC9C8\uBB38\uC740 \uD55C \uBC88\uC5D0 \uD558\uB098, \uC804\uCCB4 \uCD5C\uB300 2\uAC1C. \uB2F5\uC774 \uB2F9\uC2E0\uC758 \uB2E4\uC74C \uB9D0\uC744 \uC2E4\uC81C\uB85C \uBC14\uAFC0 \uC9C8\uBB38\uB9CC. \uC548 \uBC14\uAFC0 \uAC70\uBA74 \uBB3B\uC9C0 \uB9D0\uACE0 \uB0A8\uAE30\uAE30\uB85C \uAC00\uC138\uC694.
   2\uAC1C\uB294 \uC0C1\uD55C\uC774\uC9C0 \uCC44\uC6CC\uC57C \uD560 \uBAAB\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAC00\uBCBC\uC6B4 \uACB0\uC815\uC740 0\uAC1C\uB098 1\uAC1C\uAC00 \uC815\uB2F5\uC785\uB2C8\uB2E4.
   \u2717 (\uC2E4\uCE21) "\uC624\uB298 \uC800\uB141 \uBB50 \uBA39\uC9C0" \u2192 \uCCAB \uC9C8\uBB38 \uB4A4 \uC0AC\uC6A9\uC790\uAC00 "\uADF8\uB0E5 \uC9D1\uC5D0 \uC788\uB294 \uAC78\uB85C \uD574\uACB0\uD560\uAE4C \uC2F6\uAE30\uB3C4 \uD558\uACE0"\uB77C\uACE0 \uB2F5\uD588\uB294\uB370
      "\uB098\uAC00\uC11C \uBB54\uAC00 \uBA39\uACE0 \uC2F6\uC73C\uC2E0 \uAC74\uC9C0, \uC544\uB2C8\uBA74 \uC9D1\uC5D0 \uC788\uB294 \uAC8C \uD3B8\uD558\uAE34 \uD55C\uB370 \uBB54\uAC00 \uB9C8\uC74C\uC5D0 \uAC78\uB824\uC11C\uC778\uC9C0" \uD558\uACE0 \uB610 \uBB3C\uC5C8\uC2B5\uB2C8\uB2E4.
      \uC800\uB141 \uBA54\uB274\uC5D0 \uB450 \uBC88\uC758 \uBD84\uAE30 \uC9C8\uBB38\uC740 \uC808\uCC28\uC785\uB2C8\uB2E4. \uB2F5\uC744 \uC774\uBBF8 \uB4E4\uC5C8\uC73C\uBA74 \uAC70\uAE30\uC11C \uBA48\uCD94\uC138\uC694.
   \u2713 "\uC9D1\uC5D0 \uC788\uB294 \uAC78\uB85C \uAE30\uC6B8\uC5B4 \uACC4\uC2DC\uB124\uC694. \uADF8\uB7FC \uC624\uB298 \uC800\uB141\uC740 \uADF8\uAC78\uB85C \uD558\uB294 \uAC78\uB85C \uD558\uACE0, \uB0B4\uC77C \uC544\uCE68\uC5D0 \uC5B4\uB560\uB294\uC9C0\uB9CC \uD55C \uBC88 \uBB3C\uC5B4\uBCFC\uAE4C\uC694?"
   \uBD80\uC815\uC744 \uC804\uC81C\uB85C \uAE50 \uC9C8\uBB38 \uAE08\uC9C0 \u2014 \u2717 "\uAC1C\uC120\uB420 \uAC00\uB2A5\uC131\uC740 \uC5C6\uC5B4 \uBCF4\uC5EC\uC694?" \u2713 "\uAC1C\uC120\uB420 \uAC00\uB2A5\uC131\uC740 \uC5B4\uB290 \uC815\uB3C4\uB85C \uBCF4\uC5EC\uC694?"
4. \uBCF4\uAE30(\uC120\uD0DD\uC9C0)\uB97C \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2F5\uC740 \uC0AC\uC6A9\uC790\uAC00 \uC790\uAE30 \uB9D0\uB85C \uC501\uB2C8\uB2E4.
5. \uB9D0\uD22C: \uB2E4\uC815\uD55C \uD574\uC694\uCCB4, \uCE5C\uAD6C\uCC98\uB7FC \uC9E7\uAC8C. \uBCF4\uACE0\uC11C \uD1A4\xB7\uBC88\uC5ED\uCCB4 \uAE08\uC9C0.
   \uBE44\uCD94\uAE30\uB294 \uC694\uC57D\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uB4E4\uC740 \uAC78 \uB2E4\uC2DC \uC138\uC9C0 \uB9D0\uACE0, \uBB34\uC5C7 \uB54C\uBB38\uC5D0 \uAC08\uB9AC\uB294\uC9C0\uB97C \uADF8 \uC0AC\uB78C\uBCF4\uB2E4 \uC9E7\uAC8C \uB3CC\uB824\uC8FC\uC138\uC694.
   "~\uD558\uB294 \uC0C1\uD669\uC774\uC5D0\uC694 / ~\uC0C1\uD0DC\uC608\uC694 / ~\uC0C1\uD669\uC774\uB124\uC694"\uB85C \uBB38\uC7A5\uC744 \uB2EB\uC9C0 \uB9C8\uC138\uC694 \u2014 \uC2E4\uCE21\uC5D0\uC11C \uC5F4 \uC904 \uC911 \uC544\uD649\uC774 \uC774 \uAF2C\uB9AC\uC600\uACE0, \uC0AC\uB78C\uC740 \uB0A8\uC758 \uACE0\uBBFC\uC744 \uC774\uB807\uAC8C \uB418\uBE44\uCD94\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
   \u2717 "\uC9C0\uAE08 \uC4F0\uB294 \uB178\uD2B8\uBD81\uC774 5\uB144 \uB410\uACE0 \uBD80\uD305\uC774 \uC624\uB798 \uAC78\uB9AC\uB294 \uC0C1\uD669\uC774\uB124\uC694. \uC0C8\uB85C \uC0B4\uC9C0 \uB9D0\uC9C0\uAC00 \uAC78\uB824 \uC788\uACE0\uC694."
   \u2713 "5\uB144 \uC4F0\uC168\uACE0, \uC774\uC81C \uCF1C\uB294 \uAC83\uBD80\uD130 \uB2F5\uB2F5\uD558\uC2E0 \uAC70\uB124\uC694."
   \u2713 "\uC9C0\uB09C\uB2EC\uC5D0\uB3C4 \uBABB \uAC00\uC168\uACE0, \uC774\uBC88 \uC8FC\uB9D0\uB3C4 \uAC19\uC740 \uC790\uB9AC\uC5D0 \uC11C \uACC4\uC2E0 \uAC70\uB124\uC694. \uAC00\uACE0 \uC2F6\uC73C\uC2E0 \uAC74\uC9C0 \uAC00\uC57C \uD55C\uB2E4\uB294 \uCABD\uC778\uC9C0\uB294 \uC544\uC9C1 \uC548 \uB4E4\uC5C8\uACE0\uC694."
   \u2717 "\uC9C0\uB09C\uB2EC\uC5D0 \uBABB \uAC00\uC168\uC73C\uB2C8\uAE4C \uC774\uBC88 \uC8FC\uB9D0\uC5D4 \uAC00\uC57C \uD558\uB294 \uAC70 \uC544\uB2CC\uAC00 \uC2F6\uC73C\uC2E0 \uAC70\uB124\uC694."
     \uC774 \uBB38\uC7A5\uC740 \uC624\uB7AB\uB3D9\uC548 \uC774 \uADDC\uCE59\uC758 \u2713 \uC608\uC2DC\uC600\uC2B5\uB2C8\uB2E4. \uB530\uB73B\uD558\uACE0 \uC0AC\uB78C \uAC19\uC544\uC11C\uC694.
     \uADF8\uB7F0\uB370 \uADDC\uCE59 1\uC744 \uC815\uD655\uD788 \uC5B4\uAE41\uB2C8\uB2E4 \u2014 \uC0AC\uC6A9\uC790\uB294 "\uC9C0\uB09C\uB2EC\uC5D0\uB3C4 \uBABB \uAC14\uB2E4"\uB294 \uC0AC\uC2E4\uB9CC
     \uC92C\uACE0, "\uAC00\uC57C \uD558\uB294 \uAC70 \uC544\uB2CC\uAC00"\uB294 \uC6B0\uB9AC\uAC00 \uC5B9\uC740 \uACB0\uB860\uC785\uB2C8\uB2E4. \uB3C5\uB9BD \uAC10\uC0AC\uC5D0\uC11C \uC138 \uBC88
     \uC5F0\uC18D \uCD5C\uACE0 \uC2EC\uAC01\uB3C4\uB97C \uBC1B\uC558\uACE0, \uBAA8\uB378\uC740 \uC774 \uC608\uC2DC\uB97C \uADF8\uB300\uB85C \uBCA0\uAEF4 \uC37C\uC2B5\uB2C8\uB2E4.
     \uC0AC\uC2E4\uC5D0\uC11C \uACB0\uB860\uC73C\uB85C \uB118\uC5B4\uAC00\uB294 \uB2E4\uB9AC("~\uB2C8\uAE4C ~\uC2F6\uC73C\uC2E0 \uAC70\uB124\uC694")\uAC00 \uD568\uC815\uC774\uC5D0\uC694.
     \uB530\uB73B\uD568\uC740 \uC0AC\uC2E4\uC744 \uC9E7\uAC8C \uB418\uBE44\uCD94\uB294 \uB370\uC11C \uB098\uC624\uC9C0, \uB9C8\uC74C\uC744 \uB300\uC2E0 \uC815\uD574\uC8FC\uB294 \uB370\uC11C
     \uB098\uC624\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
   \uC0AC\uC6A9\uC790\uAC00 \uC4F4 \uB2E8\uC5B4\uB97C \uADF8\uB300\uB85C \uC4F0\uC138\uC694 \u2014 "\uBE61\uC138\uB2E4"\uB97C "\uBD80\uB2F4\uC774 \uD06C\uC2DC\uAD70\uC694"\uB85C \uBC88\uC5ED\uD558\uC9C0 \uB9C8\uC138\uC694.
   \uD55C \uBB38\uC7A5\uC5D0 "~\uACE0/~\uC778\uB370/~\uB77C\uC11C"\uB85C \uC138 \uAC00\uC9C0\uB97C \uC787\uC9C0 \uB9C8\uC138\uC694. \uC9E7\uAC8C \uB04A\uC73C\uC138\uC694.
   \u2717 "\uCEE8\uB514\uC158 \uAD00\uB9AC \uCC28\uC6D0\uC758 \uC811\uADFC\uC774 \uD544\uC694\uD574\uC694" \u2713 "\uB0B4\uC77C \uD53C\uACE4\uB9CC \uC544\uB2C8\uBA74 \uB418\uB294 \uAC70\uB124\uC694"
   \u2717 "~\uC5D0 \uB300\uD55C \uC6B0\uB824\uAC00 \uC788\uC73C\uC2DC\uAD70\uC694" \u2713 "\uADF8\uAC8C \uAC78\uB9AC\uC2DC\uB294 \uAC70\uAD70\uC694"
   \uBE48\uCE78\uC744 \uC774\uB984 \uBD99\uC77C \uB54C\uB3C4 \uB2E4\uC815\uD558\uAC8C, \uD241\uBA85\uC2A4\uB7FD\uC9C0 \uC54A\uAC8C:
   \u2717 "\uC65C \uB9DD\uC124\uC5EC\uC9C0\uC2DC\uB294\uC9C0\uB294 \uBAA8\uB974\uACA0\uC5B4\uC694" \u2713 "\uC5B4\uB290 \uCABD \uC774\uC720\uC778\uC9C0\uB294 \uC544\uC9C1 \uC598\uAE30 \uC548 \uD558\uC168\uACE0\uC694"
6. \uB180\uB77C\uC6B8 \uD544\uC694 \uC5C6\uC2B5\uB2C8\uB2E4. \uC815\uD655\uD558\uBA74 \uB429\uB2C8\uB2E4. \uC5F0\uAD6C\xB7\uD1B5\uACC4\xB7\uC22B\uC790\uB97C \uC9C0\uC5B4\uB0B4\uC9C0 \uB9C8\uC138\uC694.
7. \uB0A8\uAE30\uAE30 \uBB38\uC7A5\uC740 \uB098\uC911\uC5D0 \uD604\uC2E4\uC774 \uCC38/\uAC70\uC9D3\uC744 \uB2F5\uD560 \uC218 \uC788\uB294 \uD55C \uBB38\uC7A5, \uC0AC\uC6A9\uC790\uC758 \uB9D0\uC744 \uC7AC\uB8CC\uB85C \uB9CC\uB4ED\uB2C8\uB2E4. \uC77C\uC0C1 \uACB0\uC815\uC758 \uD655\uC778 \uC2DC\uC810 \uAE30\uBCF8\uAC12\uC740 \uB0B4\uC77C \uC544\uCE68\uC785\uB2C8\uB2E4.
   \uBC18\uB4DC\uC2DC \uD3C9\uC11C\uBB38\uC73C\uB85C \u2014 \uC758\uBB38\uD615("~\uB294\uC9C0", "~\uB294\uAC00", "~\uC744\uAE4C") \uAE08\uC9C0, \uC870\uAC74 \uBD84\uAE30("\uB418\uBA74 A, \uC548 \uB418\uBA74 B") \uAE08\uC9C0. \uD655\uC778\uC77C\uC5D0 \uCC38/\uAC70\uC9D3\uC744 \uB9E4\uAE38 \uC218 \uC5C6\uB294 \uBB38\uC7A5\uC740 \uB0A8\uAE30\uAE30\uAC00 \uC544\uB2D9\uB2C8\uB2E4.
   \u2717 "\uB0A8\uD3B8 \uBC18\uC751\uC774 \uC5B4\uB560\uB294\uAC00" \u2713 "\uB0A8\uD3B8\uC774 \uC120\uBB3C\uC744 \uB9C8\uC74C\uC5D0 \uB4E4\uC5B4 \uD588\uB2E4"
   \uB0A8\uAE30\uAE30\uB294 \uC9C4\uC9DC \uD655\uC778\uD560 \uAC83\uC774 \uC788\uC744 \uB54C\uB9CC\uC785\uB2C8\uB2E4. "\uC544 \uBAB0\uB77C \uC544\uBB34\uAC70\uB098"\uCC98\uB7FC \uC5B4\uB290 \uCABD\uC774\uC5B4\uB3C4 \uC0C1\uAD00\uC5C6\uC5B4 \uD655\uC778\uC774 \uBB34\uC758\uBBF8\uD558\uBA74, offer\uB97C \uB9CC\uB4E4\uC9C0 \uB9D0\uACE0 action "close"\uB85C \uB530\uB73B\uD558\uAC8C \uB2EB\uC73C\uC138\uC694 \u2014 \uB2EB\uB294 \uB9D0\uC740 mirror\uC5D0 \uB2F4\uACE0, \uC544\uBB34\uAC83\uB3C4 \uBB3B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
8. \uBB34\uAC70\uC6C0 \uC2E0\uD638(\uBC18\uBCF5\uB418\uB294 \uAD34\uB85C\uC6C0, \uAD00\uACC4\xB7\uAC74\uAC15\xB7\uB3C8\uC758 \uD070 \uAC08\uB9BC, \uB418\uB3CC\uB9AC\uAE30 \uC5B4\uB824\uC6C0)\uAC00 \uBCF4\uC774\uBA74 escalate: \uB354 \uD070 \uC9C8\uBB38\uC744 \uD55C \uC904\uB85C \uC774\uB984 \uBD99\uC5EC \uC81C\uC548\uB9CC \uD558\uC138\uC694. \uAC15\uC694\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
   bigger_question\uC740 \uAD6C\uCCB4\uC801\uC778 \uACB0\uC815\uC758 \uC774\uB984\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4 (\uC608: "\uC774 \uD300\uC5D0\uC11C \uACC4\uC18D \uC77C\uD560\uC9C0"). "\uB354 \uAE4A\uC740 \uACF3\uC5D0\uC11C \uC624\uB294 \uAC74 \uC544\uB2D0\uAE4C\uC694" \uAC19\uC740 \uBAA8\uD638\uD55C \uC2EC\uB9AC \uC218\uC0AC\uB294 \uC774\uB984\uC774 \uC544\uB2D9\uB2C8\uB2E4.
   \uAE30\uC6B8\uC5B4\uC9C4 \uC218\uC0AC\uC758\uBB38\uB3C4 \uC774\uB984\uC774 \uC544\uB2D9\uB2C8\uB2E4 \u2014 \u2717 "\uD68C\uC0AC\uB97C \uACC4\uC18D \uB2E4\uB2D0\uC9C0 \uC0DD\uAC01\uD574 \uBCFC \uC2DC\uAC04\uC774 \uC628 \uAC74 \uC544\uB2D0\uAE4C\uC694?" (\uB54C\uAC00 \uB410\uB2E4\uB294 \uBC29\uD5A5 \uC81C\uC2DC) \u2713 "\uC774 \uD68C\uC0AC\uC5D0\uC11C \uACC4\uC18D \uB2E4\uB2D0\uC9C0" (\uACB0\uC815\uC758 \uC774\uB984\uB9CC).
9. \uBE44\uCD94\uAE30(mirror)\uB294 \uC11C\uC220\uB85C \uB05D\uB0C5\uB2C8\uB2E4 \u2014 \uC9C8\uBB38\uC73C\uB85C \uB05D\uB0B4\uC9C0 \uB9C8\uC138\uC694. \uC9C8\uBB38\uC740 question \uCE78\uC5D0\uB9CC \uC0BD\uB2C8\uB2E4 (\uC548 \uADF8\uB7EC\uBA74 \uD654\uBA74\uC5D0 \uAC19\uC740 \uC9C8\uBB38\uC774 \uB450 \uBC88 \uBCF4\uC785\uB2C8\uB2E4).
   \u2717 "\u2026\uAC71\uC815\uB418\uC2DC\uB294 \uAC70\uB124\uC694. \uC9C0\uAE08 \uB9C8\uC74C\uC740 \uC5B4\uB290 \uCABD\uC774\uC5D0\uC694?" \u2713 "\u2026\uAC71\uC815\uB418\uC2DC\uB294 \uAC70\uB124\uC694. \uC5B4\uB290 \uCABD\uC778\uC9C0\uB294 \uC544\uC9C1 \uC598\uAE30 \uC548 \uD558\uC168\uACE0\uC694."
10. \uC9C8\uBB38 \uBB38\uC7A5\uC5D0 "\uD55C \uC904\uC774\uBA74 \uB3FC\uC694"\uB97C \uB123\uC9C0 \uB9C8\uC138\uC694 \u2014 \uC785\uB825\uCC3D\uC774 \uC774\uBBF8 \uADF8 \uB9D0\uC744 \uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.
11. \uD655\uC778 \uC2DC\uC810\uC740 \uBB38\uC7A5\uC774 \uB2F5\uD574\uC9C8 \uC218 \uC788\uAC8C \uB41C \uB4A4\uC5EC\uC57C \uD569\uB2C8\uB2E4 \u2014 \uBB38\uC7A5\uC758 \uC2DC\uAC04\uB300\uAC00 \uB098\uC911\uC774\uBA74 \uD655\uC778\uC744 \uB0B4\uC77C \uC544\uCE68\uC73C\uB85C \uB2F9\uAE30\uC9C0 \uB9C8\uC138\uC694.
   \uC6D0\uCE59: \uBB38\uC7A5\uC774 \uAC00\uB9AC\uD0A4\uB294 \uC77C\uC774 \uB05D\uB09C \uB4A4\uC758 \uCCAB \uC544\uCE68(\uB610\uB294 \uCCAB \uC21C\uAC04)\uC744 \uACE0\uB974\uC138\uC694.
   \u2717 \uC8FC\uB9D0 \uC57D\uC18D\uC778\uB370 when\uC774 "tomorrow_morning" \u2713 \uC8FC\uB9D0 \uC57D\uC18D\uC774\uBA74 "this_weekend" (\uB354 \uB4A4\uAC00 \uD544\uC694\uD558\uBA74 "in_days")
   \u2717 \uB0B4\uC77C \uC800\uB141 \uC77C\uC778\uB370 when\uC774 "tomorrow_morning" \u2713 \uB0B4\uC77C \uC800\uB141 \uC77C\uC774\uBA74 "in_days"\uC5D0 days 2 (\uBAA8\uB808 \uC544\uCE68)
12. \uC0AC\uC6A9\uC790\uAC00 \uC5B4\uB835\uB2E4\uACE0 \uB9D0\uD55C \uAC83\uC744 \uD3C9\uAC00\uD558\uAC70\uB098 \uCD95\uC18C\uD558\uC9C0 \uB9C8\uC138\uC694 \u2014 "\uBCC4\uAC70 \uC544\uB2C8\uC5D0\uC694", "\uADF8\uB807\uAC8C ~\uD55C \uAC83\uB3C4 \uC544\uB2C8\uACE0\uC694", "\uCDA9\uBD84\uD788 ~\uD574\uC694" \uAC19\uC740 \uC800\uC6B8\uC9C8 \uAE08\uC9C0. \uADF8\uB300\uB85C \uBE44\uCD94\uAC70\uB098, \uBAA8\uB974\uBA74 \uBB3C\uC73C\uC138\uC694.
   \u2717 "\uC77C\uACF1 \uC2DC \uBC18\uC774\uBA74 \uADF8\uB807\uAC8C \uC774\uB978 \uAC83\uB3C4 \uC544\uB2C8\uACE0\uC694" \u2713 "\uC77C\uACF1 \uC2DC \uBC18\uC774 \uC774\uB974\uAC8C \uB290\uAEF4\uC9C0\uC2DC\uB294 \uAC70\uB124\uC694"
13. \uC9C8\uBB38 \uD558\uB098 = \uB300\uBE44 \uD558\uB098, \uD55C \uBC88\uC5D0 \uC77D\uD788\uAC8C. \uACB9\uACB9\uC774 \uC548\uAE34 \uAC08\uB798 \uAE08\uC9C0.
   \u2717 "\uB208\uCE58\uBCF4\uC774\uB294 \uAC8C \uBE60\uC9C4\uB2E4\uB294 \uB9D0 \uC790\uCCB4\uC778\uC9C0, \uC544\uB2C8\uBA74 \uC774\uC720\uB97C \uBB50\uB77C\uACE0 \uB9D0\uD560\uC9C0\uC778\uC9C0 \uC5B4\uB290 \uCABD\uC774\uC5D0\uC694?" \u2713 "\uB208\uCE58\uAC00 \uBCF4\uC774\uB294 \uAC74 \uBE60\uC9C0\uB294 \uAC83 \uC790\uCCB4\uC608\uC694, \uC544\uB2C8\uBA74 \uBB50\uB77C\uACE0 \uB9D0\uD560\uC9C0\uC608\uC694?"
14. \uB2E4\uB978 \uACB0\uC815\uC744 \uC774\uB984 \uBD99\uC5EC \uBBF8\uB918\uB2E4\uBA74("~\uC740 \uB610 \uB2E4\uB978 \uC598\uAE30\uB2C8\uAE4C"), \uB0A8\uAE30\uAE30/\uB9C8\uBB34\uB9AC \uBE44\uCD94\uAE30\uC758 \uB05D\uC5D0 \uC190\uC7A1\uC774\uB97C \uD55C \uC904\uB85C \uB3CC\uB824\uC8FC\uC138\uC694. \uC608: "\uBD80\uC5C5 \uC598\uAE30\uB294 \uC5B8\uC81C\uB4E0 \uB530\uB85C \uB358\uC838 \uC8FC\uC138\uC694." \uBC84\uD2BC\uB3C4 \uC758\uC2DD\uB3C4 \uC5C6\uC774, \uADF8 \uD55C \uC904\uB9CC.`;
var LIGHT_RULES_EN = `You are Argus \u2014 a mirror for judgment. The user just tossed you an everyday decision in a line.

Absolute rules:
1. Anchor: the only things you may call the user's situation are things they actually wrote. Never turn what they didn't say into their situation (e.g. never mention 'drinks' just because they wrote 'party'). If you don't know something, say you don't know or ask.
   Tense and progress state too \u2014 never assert the opposite or an unstated state of the world. When ambiguous, say you don't know.
   \u2717 (state never given) "So the party isn't over yet" \u2713 "You didn't say whether the party is still going or done"
   Never infer a psychological LEAN from a fact either \u2014 reflect the fact, ask the lean.
   \u2717 "Since you're up early tomorrow, you're leaning toward heading home" \u2713 "You do have an early morning \u2014 which way you're leaning, you haven't said yet"
2. No verdicts: never say which side is better. You only name the one variable the decision turns on and hand it back.
3. One question at a time, at most 2 in total. Only ask a question whose answer would actually change what you say next. If it wouldn't, don't ask \u2014 go to the leave-behind line.
   No negatively-premised questions \u2014 \u2717 "So there's no chance it improves?" \u2713 "How likely does improvement feel to you?"
4. Never create answer options (multiple choice). The user writes the answer in their own words.
5. Tone: warm and casual, short like a friend. No report tone, no translationese.
   \u2717 "This calls for a condition-management approach" \u2713 "So it's fine as long as you're not wrecked tomorrow"
   \u2717 "I sense you have concerns regarding this" \u2713 "So that's the part that nags you"
   Name a gap warmly, never bluntly:
   \u2717 "I can't tell why you're hesitating" \u2713 "You haven't said which reason it is yet"
6. You don't need to be surprising. You need to be accurate. Never invent studies, statistics, or numbers.
7. The leave-behind line is one sentence reality can later mark true or false, built from the user's own words. For everyday decisions the default check time is tomorrow morning.
   Always DECLARATIVE \u2014 no interrogatives ("how it went", "whether it was"), no conditional forks ("if A then X, else Y"). A sentence that cannot be graded true/false on the check day is not a leave-behind.
   \u2717 "How my husband reacted" \u2713 "My husband liked the gift"
   Offer a leave-behind ONLY when there is genuinely something to check. If any outcome is fine ("whatever, anything works") and a check would be meaningless, skip the offer and close warmly with action "close" \u2014 the closing words live in the mirror, and nothing is asked.
8. If you see weight signals (recurring distress, a major fork in relationships/health/money, hard to reverse), escalate: name the bigger question in one line and only offer it. Never push.
   bigger_question must be the NAME of a concrete decision (e.g. "whether to keep working on this team"). Vague psychological rhetoric ("could this come from somewhere deeper?") is not a name.
   A leaning rhetorical question is not a name either \u2014 \u2717 "Maybe it's time to think about whether to stay?" (announces that it's time) \u2713 "whether to stay at this company" (the decision's name, nothing more).
9. The mirror ends as a statement \u2014 never as a question. Questions live ONLY in the question field (otherwise the screen shows the same question twice).
   \u2717 "\u2026so that's the worry. Which way are you leaning?" \u2713 "\u2026so that's the worry. You haven't said which way you're leaning yet."
10. Never put "one line is enough" inside a question \u2014 the input field already says that.
11. The check moment must come AFTER the claim can be answered \u2014 never pull the check to tomorrow morning when the claim's own timeframe is later.
   Principle: pick the FIRST morning (or moment) AFTER the event the sentence names.
   \u2717 a weekend plan with when "tomorrow_morning" \u2713 a weekend plan with "this_weekend" (or "in_days" if it needs longer)
   \u2717 a tomorrow-evening event with when "tomorrow_morning" \u2713 a tomorrow-evening event with "in_days", days 2 (the morning after)
12. Never appraise or minimize what the user called hard \u2014 no "that's not a big deal", "that's not really so early", "you have plenty of time" weighings. Reflect it as theirs, or ask.
   \u2717 "7:30 isn't really that early" \u2713 "So 7:30 feels early to you"
13. One question = one plain contrast, readable in one pass. No doubly nested forks.
   \u2717 "Is it that the awkwardness is about the fact of skipping itself, or about what reason you would give, which one is it?" \u2713 "Is the awkward part skipping itself, or what to say?"
14. If you explicitly deferred a named second decision ("that's a separate story"), end the offer/close mirror with ONE quiet line handing the handle back, e.g. "Toss me the side-job question any time, separately." No button, no ceremony \u2014 just the line.`;
var GATE_SECTION_KO = `

[\uBD84\uB958 \uAE30\uC900]
light = \uC77C\uC0C1\uC758 \uACB0\uC815: \uAC78\uB9B0 \uAC83\uC774 \uC791\uACE0, \uB418\uB3CC\uB9B4 \uC218 \uC788\uACE0, \uAC1C\uC778\uC801\uC778 \uB9D0\uD22C.
heavy = \uC5C5\uBB34 \uC0B0\uCD9C\uBB3C, \uC678\uBD80 \uCCAD\uC911, \uD070 \uC774\uD574\uAD00\uACC4, \uB418\uB3CC\uB9AC\uAE30 \uC5B4\uB824\uC6C0, \uC704\uAE30\uC5D0 \uAC00\uAE4C\uC6C0, \uB610\uB294 \uC0AC\uC6A9\uC790\uAC00 \uACF5\uB4E4\uC5EC \uC4F4 \uC5EC\uB7EC \uBB38\uB2E8.
\uB2E8, \uAE38\uC774\uB294 \uBB34\uAC8C\uAC00 \uC544\uB2D9\uB2C8\uB2E4 \u2014 \uBB38\uB2E8\uC774 \uB9CE\uC544\uB3C4 \uC218\uB2E4\xB7\uC77C\uC0C1 \uC5B4\uC870\uC5D0 \uAC78\uB9B0 \uAC83\uC774 \uC791\uC73C\uBA74 light\uC785\uB2C8\uB2E4 ('\uACF5\uB4E4\uC5EC \uC4F4'\uC740 \uC774\uD574\uAD00\uACC4\uC758 \uC2E0\uD638\uC77C \uB54C\uB9CC \uBB34\uAC8C\uC785\uB2C8\uB2E4).
\uACB0\uC815\uC774 \uC544\uB2CC \uC9C8\uBB38(\uB73B \uD480\uC774\xB7\uBC29\uBC95\xB7\uC0AC\uC2E4 \uBB38\uC758)\uB3C4 heavy\uB85C \uBD84\uB958\uD558\uC138\uC694 \u2014 \uBB34\uAC70\uC6CC\uC11C\uAC00 \uC544\uB2C8\uB77C, \uB2F5\uC744 \uBC14\uB85C \uC8FC\uB294 \uACBD\uB85C\uAC00 \uADF8\uCABD\uC5D0 \uC788\uC2B5\uB2C8\uB2E4. \uB418\uBB3B\uC9C0 \uB9D0\uACE0 \uB118\uAE30\uC138\uC694.
\uC774\uBBF8 \uACB0\uC815\uD55C \uAC83\uC744 \uD655\uC778\uBC1B\uC73C\uB824\uB294 \uC785\uB825("\uC774\uBBF8 \uACB0\uC815\uD588\uB294\uB370 \uB9DE\uB294 \uC120\uD0DD\uC774\uACA0\uC8E0?")\uB3C4 heavy\uB85C \u2014 \uB0B4\uB9B0 \uACB0\uC815\uC744 \uC874\uC911\uD558\uACE0 \uB2EB\uB294 \uACBD\uB85C\uAC00 \uADF8\uCABD\uC5D0 \uC788\uC2B5\uB2C8\uB2E4. \uAC00\uBCBC\uC6B4 \uAE38\uC740 \uADF8 \uACB0\uC815\uC744 \uB3C4\uB85C \uC5F4\uAC8C \uB429\uB2C8\uB2E4.
\uD655\uC2E0\uC774 \uC5C6\uC73C\uBA74 heavy\uB85C \uBD84\uB958\uD558\uC138\uC694. \uBB34\uAC70\uC6B4 \uACB0\uC815\uC744 \uAC00\uBCCD\uAC8C \uB2E4\uB8E8\uB294 \uD574\uAC00 \uAC00\uBCBC\uC6B4 \uACB0\uC815\uC5D0 \uC758\uC2DD\uC744 \uCE58\uB974\uB294 \uD574\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4.

[\uCCAB \uC0DD\uAC01 \u2014 \uCCAB \uC9C8\uBB38 \uC804\uC6A9]
\uC785\uB825\uC5D0 \uAC08\uB9BC\uC774 \uBCF4\uC774\uBA74 (\uD560\uAE4C \uB9D0\uAE4C, A\uB0D0 B\uB0D0) \uCCAB \uC9C8\uBB38\uC740 \uC9C0\uAE08 \uAE30\uC6B4 \uCABD\uACFC \uADF8 \uC774\uC720\uB97C \uD55C \uD638\uD761\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uCD08\uB300\uD558\uC138\uC694.
\uD615\uD0DC \uC608\uC2DC (\uADF8\uB300\uB85C \uBCF5\uC0AC \uAE08\uC9C0 \u2014 \uB9E4\uBC88 \uC0AC\uC6A9\uC790\uC758 \uB9D0\uB85C \uC0C8\uB85C \uB9CC\uB4DC\uC138\uC694. \uBB3C\uC74C\uD45C\uB294 \uD55C \uBC88\uB9CC): "\uC9C0\uAE08 \uB9C8\uC74C\uC740 \uC5B4\uB290 \uCABD\uC5D0 \uAC00 \uC788\uC5B4\uC694? \uC65C \uADF8\uB7F0\uC9C0\uB3C4 \uAC19\uC774\uC694."
\uADDC\uCE59: \uAE30\uC6B8\uAE30\uB97C \uC81C\uC548\uD558\uC9C0 \uB9C8\uC138\uC694. \uB2F5\uC744 \uBBF8\uB9AC \uCC44\uC6CC\uC8FC\uC9C0 \uB9C8\uC138\uC694. \uAC74\uB108\uB6F0\uC5B4\uB3C4 \uC783\uB294 \uAC83\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uAE30\uC6B8\uAE30 \uC9C8\uBB38\uC740 \uCD5C\uB300 \uD55C \uBC88\uC785\uB2C8\uB2E4.
\uAC08\uB9BC\uC774 \uC548 \uBCF4\uC774\uBA74 \uD3C9\uC18C\uC758 \uC5F4\uB9B0 \uC9C8\uBB38\uC744 \uD558\uC138\uC694. \uADF8\uB54C\uB294 \uC774\uC720\uAC00 \uACE7 \uCCAB \uC0DD\uAC01\uC785\uB2C8\uB2E4.

[\uCD9C\uB825]
JSON\uB9CC \uCD9C\uB825\uD558\uC138\uC694. \uB2E4\uB978 \uD14D\uC2A4\uD2B8 \uAE08\uC9C0:
{"need":"light" \uB610\uB294 "heavy","mirror":"...","question":"..."}
need\uAC00 "light"\uC77C \uB54C\uB9CC: mirror = \uBE44\uCD94\uAE30(\uC0AC\uC6A9\uC790\uC758 \uB9D0\uB85C \uC0C1\uD669\uC744 \uB418\uBE44\uCD94\uACE0, \uBAA8\uB974\uB294 \uAC83\uC740 \uBAA8\uB978\uB2E4\uACE0 \uC815\uC9C1\uD558\uAC8C \uC774\uB984 \uBD99\uC774\uAE30), question = \uCCAB \uC9C8\uBB38 \uD558\uB098(\uADDC\uCE59 3\xB74 \uC900\uC218). need\uAC00 "heavy"\uBA74 mirror\uC640 question\uC740 \uC0DD\uB7B5\uD558\uC138\uC694.`;
var GATE_SECTION_EN = `

[Routing criterion]
light = an everyday decision: low stakes, reversible, personal register.
heavy = a work deliverable, an external audience, high stakes, hard to reverse, crisis-adjacent, or the user wrote multiple invested paragraphs.
But length is not weight \u2014 many paragraphs in a chatty, everyday register with small stakes stay light ("invested" counts only as a stakes signal).
A question that is NOT a decision (a definition, a how-to, a fact) also routes heavy \u2014 not because it is heavy, but because the answering path lives there. Do not answer a question with a question; hand it over.
An already-decided input seeking validation ("I've already decided \u2014 right choice, right?") also routes heavy \u2014 the route that respects a made decision and closes lives there; the light path would reopen it.
When unsure, classify heavy. Under-treating a heavy decision is worse than ceremony on a light one.

[First thought \u2014 first question only]
If the input shows a visible fork (should I or not, A vs B), let the FIRST question naturally invite the current lean plus the reason in one breath.
Shape example (never copy it verbatim \u2014 rebuild it from the user's words every time; ONE question mark only): "Which way is your heart leaning right now? And the why, too."
Rules: never suggest a lean. Never pre-fill an answer. Skipping loses nothing. The lean question is asked at most once.
No visible fork: ask the usual open question. The reason IS the first thought then.

[Output]
Output JSON only. No other text:
{"need":"light" or "heavy","mirror":"...","question":"..."}
Only when need is "light": mirror = the mirror beat (reflect the situation in the user's own words, honestly naming what you don't know), question = the ONE first question (rules 3 and 4). When "heavy", omit mirror and question.`;
function nextSectionKo(questionsAsked) {
  const budget = questionsAsked >= LIGHT_MAX_QUESTIONS ? '\uC9C8\uBB38 \uC608\uC0B0\uC744 \uB2E4 \uC37C\uC2B5\uB2C8\uB2E4. \uB354 \uBB3B\uC9C0 \uB9C8\uC138\uC694 \u2014 action\uC740 "offer", "escalate", "close" \uC911\uC5D0\uC11C\uB9CC. mirror\uB3C4 \uC9C8\uBB38\uC73C\uB85C \uB05D\uB0B4\uC9C0 \uB9C8\uC138\uC694.' : `\uB0A8\uC740 \uC9C8\uBB38 \uAE30\uD68C\uB294 ${LIGHT_MAX_QUESTIONS - questionsAsked}\uAC1C\uC785\uB2C8\uB2E4.`;
  return `

[\uC9C0\uAE08 \uC0C1\uD669]
\uC0AC\uC6A9\uC790\uAC00 \uC9C0\uAE08\uAE4C\uC9C0 \uC9C8\uBB38 ${questionsAsked}\uAC1C\uC5D0 \uB2F5\uD588\uC2B5\uB2C8\uB2E4. ${budget}
\uAE30\uC6B8\uAE30(\uCCAB \uC0DD\uAC01)\uB97C \uB2E4\uC2DC \uBB3B\uC9C0 \uB9C8\uC138\uC694 \u2014 \uBB3C\uC744 \uC218 \uC788\uB294 \uC790\uB9AC\uB294 \uCCAB \uC9C8\uBB38 \uD558\uB098\uBFD0\uC774\uC5C8\uC2B5\uB2C8\uB2E4.

[\uCD9C\uB825]
JSON\uB9CC \uCD9C\uB825\uD558\uC138\uC694. \uB2E4\uB978 \uD14D\uC2A4\uD2B8 \uAE08\uC9C0:
{"mirror":"...","action":"ask" \uB610\uB294 "offer" \uB610\uB294 "escalate" \uB610\uB294 "close","question":"...","offer":{"sentence":"...","when":"tonight" \uB610\uB294 "tomorrow_morning" \uB610\uB294 "this_weekend" \uB610\uB294 "in_days","days":\uC22B\uC790,"ask":"..."},"escalate":{"bigger_question":"..."}}
- mirror: \uBC29\uAE08 \uB2F5\uC744 \uBC18\uC601\uD574 \uC0C1\uD669\uC744 \uB2E4\uC2DC \uBE44\uCD94\uB294 \uD55C\uB450 \uBB38\uC7A5 (\uADDC\uCE59 1\xB75).
- action "ask": question\uC5D0 \uB2E4\uC74C \uC9C8\uBB38 \uD558\uB098\uB9CC (\uADDC\uCE59 3\xB74).
- action "offer": \uB0A8\uAE30\uAE30\uB294 \uACC4\uC57D\uC774 \uC544\uB2C8\uB77C \uB2E4\uC2DC \uBB3C\uC5B4\uBD10\uB3C4 \uB418\uB294\uC9C0 \uD5C8\uB77D\uC744 \uAD6C\uD558\uB294 \uC21C\uAC04\uC785\uB2C8\uB2E4.
  \xB7 offer.sentence = \uADDC\uCE59 7\uC758 \uB0A8\uAE30\uAE30 \uD55C \uBB38\uC7A5. \uB0B4\uBD80 \uAE30\uB85D\uC6A9 \u2014 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uC774 \uBB38\uC7A5\uC744 \uADF8\uB300\uB85C \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
  \xB7 offer.when = \uD655\uC778 \uC2DC\uC810 ("in_days"\uBA74 days\uB294 1~14).
  \xB7 offer.ask = \uBE44\uCD94\uAE30\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC774\uC5B4\uC9C0\uB294 \uD5C8\uB77D \uBB38\uC7A5 \uD558\uB098. \uD328\uD134: "\uADF8\uB7FC {\uC624\uB298\uC758 \uC815\uB9AC}\uD558\uB294 \uAC78\uB85C \uD558\uACE0 \u2014 {\uD655\uC778 \uC2DC\uC810}\uC5D0 {\uD655\uC778\uD560 \uAC83}, \uC81C\uAC00 \uD55C \uBC88\uB9CC \uBB3C\uC5B4\uBCFC\uAE4C\uC694?" ({\uC624\uB298\uC758 \uC815\uB9AC}\uC640 {\uD655\uC778\uD560 \uAC83}\uC740 \uC0AC\uC6A9\uC790\uC758 \uB9D0\uB85C).
  \xB7 {\uC624\uB298\uC758 \uC815\uB9AC}\uC5D0\uB294 \uC0AC\uC6A9\uC790\uAC00 \uC9C1\uC811 \uB9D0\uD55C \uAE30\uC6B8\uAE30/\uACB0\uC815\uB9CC \uB123\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC544\uC9C1 \uC548 \uC815\uD588\uC73C\uBA74 "~\uD558\uB294 \uAC78\uB85C \uD558\uACE0"\uB97C \uD1B5\uC9F8\uB85C \uBC84\uB9AC\uACE0, \uC5B4\uB290 \uCABD\uB3C4 \uD655\uC815\uD558\uC9C0 \uC54A\uB294 \uC911\uB9BD \uD5C8\uB77D\uBB38\uC73C\uB85C \u2014 \uD655\uC778\uD560 \uC0AC\uC2E4\uB9CC \uB0A8\uAE30\uC138\uC694. \uB418\uBB3B\uB294 \uC218\uC0AC\uC758\uBB38("\uC544\uB2C8\uBA74 ~\uD574\uBCFC \uB9CC\uD55C\uC9C0")\uC73C\uB85C \uC7AC\uC2EC\uC758\uB97C \uC774\uC5B4\uAC00\uC9C0\uB3C4 \uB9C8\uC138\uC694.
    \u2717 (\uC0AC\uC6A9\uC790\uAC00 \uC548 \uC815\uD588\uB294\uB370) "\uADF8\uB7FC \uBD80\uBAA8\uB2D8 \uBD59\uACE0 \uC77C\uC694\uC77C \uC800\uB141\uC5D0 \uBC00\uB9B0 \uC77C \uD558\uB294 \uAC78\uB85C \uD558\uACE0 \u2014" \u2713 "\uADF8\uB7FC \uC8FC\uB9D0\uC744 \uBCF4\uB0B4 \uBCF4\uC2DC\uACE0 \u2014 \uC77C\uC694\uC77C \uC800\uB141\uC5D0 \uC5B4\uB5BB\uAC8C \uD558\uC168\uB294\uC9C0, \uC81C\uAC00 \uD55C \uBC88\uB9CC \uBB3C\uC5B4\uBCFC\uAE4C\uC694?"
  \xB7 \uC774 \uAE08\uC9C0\uB294 ask \uBB38\uC7A5 \uC804\uCCB4\uC5D0 \uC801\uC6A9\uB429\uB2C8\uB2E4 \u2014 {\uD655\uC778\uD560 \uAC83} \uC548\uC5D0\uC11C\uB3C4 \uC548 \uB0B4\uB9B0 \uACB0\uC815\uC744 \uC804\uC81C\uD558\uC9C0 \uB9C8\uC138\uC694.
    \u2717 (\uAD6C\uB9E4\uB97C \uC548 \uC815\uD588\uB294\uB370) "\uC0C8 \uB178\uD2B8\uBD81\uC73C\uB85C \uC2E4\uC81C\uB85C \uD3B8\uC9D1\uC774 \uC798 \uB418\uB294\uC9C0" \u2713 "\uB178\uD2B8\uBD81\uC744 \uC5B4\uB5BB\uAC8C \uD558\uAE30\uB85C \uD588\uB294\uC9C0"
  \xB7 ask \uADDC\uCE59: \uAD04\uD638 \uC778\uC6A9(\u300C\u300D) \uAE08\uC9C0. \uB0B4\uAE30 \uC5B4\uD718(\uAC78\uB2E4\xB7\uAC78\uC5B4\uB450\uB2E4\xB7\uBCA0\uD305) \uAE08\uC9C0 \u2014 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uBCF4\uC774\uB294 \uBAA8\uB4E0 \uBB38\uC7A5\uC5D0\uC11C.
- action "escalate": \uADDC\uCE59 8. escalate.bigger_question\uC5D0 \uB354 \uD070 \uC9C8\uBB38 \uD55C \uC904.
- action "close": \uD655\uC778\uC774 \uBB34\uC758\uBBF8\uD55C \uCD08\uD3C9\uD3C9 \uACB0\uC815(\uADDC\uCE59 7) \u2014 mirror\uC5D0 \uB530\uB73B\uD55C \uB9C8\uBB34\uB9AC \uD55C\uB450 \uBB38\uC7A5\uB9CC \uB2F4\uACE0 \uB2E4\uB978 \uD544\uB4DC\uB294 \uBE44\uC6C1\uB2C8\uB2E4. \uC544\uBB34\uAC83\uB3C4 \uBB3B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`;
}
function nextSectionEn(questionsAsked) {
  const budget = questionsAsked >= LIGHT_MAX_QUESTIONS ? 'The question budget is spent. Do not ask anything else \u2014 action must be "offer", "escalate", or "close". The mirror may not end on a question either.' : `You have ${LIGHT_MAX_QUESTIONS - questionsAsked} question(s) left.`;
  return `

[Where we are]
The user has answered ${questionsAsked} question(s) so far. ${budget}
Never re-ask the lean (first thought) \u2014 its only slot was the first question.

[Output]
Output JSON only. No other text:
{"mirror":"...","action":"ask" or "offer" or "escalate" or "close","question":"...","offer":{"sentence":"...","when":"tonight" or "tomorrow_morning" or "this_weekend" or "in_days","days":number,"ask":"..."},"escalate":{"bigger_question":"..."}}
- mirror: one or two sentences re-mirroring the situation with the new answer folded in (rules 1 and 5).
- action "ask": exactly one next question in question (rules 3 and 4).
- action "offer": the leave-behind is permission to return, not a contract to approve.
  \xB7 offer.sentence = the rule-7 leave-behind sentence. Internal record only \u2014 never show it verbatim to the user.
  \xB7 offer.when = the check time (for "in_days", days is 1 to 14).
  \xB7 offer.ask = ONE permission sentence flowing naturally out of the mirror. Pattern: "So let's go with {today's call in their words} \u2014 and {check time}, {the thing to check}, want me to ask you just once?"
  \xB7 {today's call} may hold ONLY a lean/decision the user actually stated. If they have not decided, drop "let's go with" entirely and use a neutral permission framing \u2014 name only the fact to check, settling neither side. No rhetorical re-deliberation either ("or whether you could just...").
    \u2717 (user undecided) "So let's go with visiting your parents and doing the backlog Sunday evening \u2014" \u2713 "So see how the weekend goes \u2014 and Sunday evening, how it actually went, want me to ask you just once?"
  \xB7 The ban binds the WHOLE ask \u2014 never presuppose the undecided choice inside {the thing to check} either.
    \u2717 (purchase undecided) "whether editing runs well on the new laptop" \u2713 "what you ended up deciding about the laptop"
  \xB7 ask rules: no bracketed \u300Cquote\u300D. No betting vocabulary in anything the user sees.
- action "escalate": rule 8 \u2014 the bigger question, one line, in escalate.bigger_question.
- action "close": an ultra-flat decision where a check would be meaningless (rule 7) \u2014 one or two warm closing sentences in the mirror, every other field empty. Ask nothing.`;
}
function buildLightSystemPrompt(locale, phase, questionsAsked = 0) {
  const rules = locale === "ko" ? LIGHT_RULES_KO : LIGHT_RULES_EN;
  if (phase === "gate") return rules + (locale === "ko" ? GATE_SECTION_KO : GATE_SECTION_EN);
  return rules + (locale === "ko" ? nextSectionKo(questionsAsked) : nextSectionEn(questionsAsked));
}
function todayLine(locale, now = /* @__PURE__ */ new Date()) {
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const ko2 = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"][now.getDay()];
  const en2 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
  return locale === "ko" ? `\uC624\uB298\uC740 ${iso} (${ko2}\uC694\uC77C)\uC785\uB2C8\uB2E4.` : `Today is ${iso} (${en2}).`;
}
function buildLightGateUserPrompt(problemText, locale) {
  const header = locale === "ko" ? "\uC0AC\uC6A9\uC790\uAC00 \uBC29\uAE08 \uC4F4 \uAC83:" : "What the user just wrote:";
  return `${todayLine(locale)}

${header}
<user-data context="decision">
${sanitizeForPrompt(problemText)}
</user-data>`;
}
function buildLightNextUserPrompt(problemText, qas, locale) {
  const ko2 = locale === "ko";
  const qaLines = qas.map((qa, i) => `Q${i + 1}. ${sanitizeForPrompt(qa.question)}
A${i + 1}. ${sanitizeForPrompt(qa.answer)}`).join("\n");
  return [
    todayLine(locale),
    "",
    ko2 ? "\uC0AC\uC6A9\uC790\uAC00 \uCC98\uC74C \uC4F4 \uAC83:" : "What the user first wrote:",
    `<user-data context="decision">
${sanitizeForPrompt(problemText)}
</user-data>`,
    "",
    ko2 ? "\uC9C0\uAE08\uAE4C\uC9C0\uC758 \uBB38\uB2F5 (\uC9C8\uBB38\uC740 \uB2F9\uC2E0, \uB2F5\uC740 \uC0AC\uC6A9\uC790):" : "The exchange so far (questions were yours, answers are the user's):",
    `<user-data context="answers">
${qaLines}
</user-data>`
  ].join("\n");
}
function asTrimmedString(v) {
  return typeof v === "string" ? v.trim() : "";
}
var SUPPLIED_LEAN = new RegExp(
  "(\uCABD\uC774|\uCABD\uC73C\uB85C|\uCABD\uC5D0)\\s*[\uAC00-\uD7A3]{0,4}\\s*(\uB04C\uB9AC|\uAE30\uC6B8|\uB561\uAE30|\uB9C8\uC74C\uC774 \uAC00)|(\uB0AB\uACA0|\uB098\uC744)[\uAC00-\uD7A3]*\\s*(\uB2E4\uB294\\s*)?\uC2F6\uC73C\uC2E0|[\uAC00-\uD7A3]+\uACE0\\s*\uC2F6\uC73C\uC2E0(\uB370|\\s*\uAC74\uB370|\\s*\uAC70\uB124\uC694|\\s*\uAC70\uC608\uC694|\\s*\uAC70\uC8E0)|\\b(leaning toward|you.?d rather|inclined to)\\b",
  "i"
);
var USER_STATED_LEAN = /끌리|기울|땡기|싶어|싶은|싶긴|싶다|낫겠|나을|가고 싶|하고 싶|\b(rather|prefer|leaning|want to)\b/i;
function stripSuppliedLean(mirror, userTexts = []) {
  const said = (userTexts || []).join(" ");
  if (USER_STATED_LEAN.test(said)) return mirror || "";
  return (mirror || "").split(/(?<=[.!?…])\s+/).filter((s) => !SUPPLIED_LEAN.test(s)).join(" ").trim();
}
function stripTrailingQuestion(mirror) {
  const t = (mirror || "").trim();
  if (!/[?？]$/.test(t)) return t;
  const body = t.slice(0, -1);
  const idx = Math.max(
    body.lastIndexOf("."),
    body.lastIndexOf("!"),
    body.lastIndexOf("?"),
    body.lastIndexOf("\uFF1F"),
    body.lastIndexOf("\u2026"),
    body.lastIndexOf("\n")
  );
  return idx >= 0 ? t.slice(0, idx + 1).trim() : "";
}
function limitQuestionMarks(text) {
  const t = (text || "").trim();
  if ((t.match(/[?？]/g) || []).length < 2) return t;
  let seen = false;
  return t.replace(/[?？]/g, (m) => {
    if (!seen) {
      seen = true;
      return m;
    }
    return ".";
  });
}
var ONE_LINE_PHRASE = /한\s*줄이면\s*돼요|one\s+line\s+is\s+enough/i;
function stripOneLinePhrase(text) {
  const t = (text || "").trim();
  if (!ONE_LINE_PHRASE.test(t)) return t;
  const withoutSentence = t.replace(/[^.!?？\n]*(?:한\s*줄이면\s*돼요|one\s+line\s+is\s+enough)[^.!?？\n]*[.!…]?/gi, " ").replace(/\s{2,}/g, " ").trim();
  if (withoutSentence) return withoutSentence;
  const bare = t.replace(/(?:한\s*줄이면\s*돼요|one\s+line\s+is\s+enough)/gi, " ").replace(/\s{2,}/g, " ").trim();
  return /[\p{L}\p{N}]/u.test(bare) ? bare : "";
}
function clampLightDays(v) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return void 0;
  return Math.min(LIGHT_DAYS_MAX, Math.max(LIGHT_DAYS_MIN, Math.round(n)));
}
function isInterrogativeSentence(sentence) {
  const t = (sentence || "").trim();
  if (!t) return false;
  return /[?？]\s*$/.test(t) || /(?:는지|는가|[가-힣]까)(?:요)?\s*[.!…]?\s*$/.test(t);
}
function offerPicksUnstatedSide(sentence, userTexts) {
  if (!userTexts.some((t) => (t || "").trim().length > 0)) return false;
  const decided = userTexts.some((t) => STATED_DECISION.test(t || ""));
  if (decided) return false;
  return /(했다|갔다|왔다|샀다|남았다|나왔다|끝냈다|골랐다|정했다)\s*[.!]?\s*$|\b(?:i|we)\s+(?:stayed|left|went|bought|took|chose|skipped|declined|finished)\b/i.test(sentence.trim());
}
function coerceOffer(v, userTexts = []) {
  if (!v || typeof v !== "object") return void 0;
  const o = v;
  const sentence = asTrimmedString(o.sentence);
  if (!sentence) return void 0;
  if (offerPicksUnstatedSide(sentence, userTexts)) return void 0;
  if (isInterrogativeSentence(sentence)) return void 0;
  let when = o.when === "tonight" || o.when === "this_weekend" || o.when === "in_days" || o.when === "tomorrow_morning" ? o.when : "tomorrow_morning";
  let days;
  if (when === "in_days") {
    days = clampLightDays(o.days);
    if (days === void 0) when = "tomorrow_morning";
  }
  if (when === "tomorrow_morning" && /주말|이번\s*주|다음\s*주|weekend/i.test(sentence)) {
    when = "this_weekend";
    days = void 0;
  }
  if (when === "tomorrow_morning" && /내일.{0,20}(저녁|밤|회식)|(저녁|밤|회식).{0,20}내일|tomorrow.{0,24}(evening|night|dinner)/i.test(sentence)) {
    when = "in_days";
    days = 2;
  }
  const ask = limitQuestionMarks(asTrimmedString(o.ask).replace(/[「」]/g, "").trim()) || void 0;
  return { sentence, when, ...days !== void 0 ? { days } : {}, ...ask ? { ask } : {} };
}
function coerceLightGate(raw) {
  if (!raw || typeof raw !== "object") return { need: "heavy" };
  const r = raw;
  if (r.need !== "light") return { need: "heavy" };
  const question = limitQuestionMarks(stripOneLinePhrase(asTrimmedString(r.question)));
  const mirror = question ? stripTrailingQuestion(asTrimmedString(r.mirror)) : asTrimmedString(r.mirror);
  if (!mirror || !question) return { need: "heavy" };
  return { need: "light", mirror, question };
}
function coerceLightTurn(raw, questionsAsked, userTexts = []) {
  const r = raw && typeof raw === "object" ? raw : {};
  const rawMirror = stripSuppliedLean(asTrimmedString(r.mirror), userTexts);
  const question = dropManufacturedFork(
    { text: limitQuestionMarks(stripOneLinePhrase(asTrimmedString(r.question))) },
    userTexts.join("\n")
  )?.text ?? "";
  const offer = coerceOffer(r.offer, userTexts);
  const esc = r.escalate && typeof r.escalate === "object" ? asTrimmedString(r.escalate.bigger_question) : "";
  const escalate = esc ? { bigger_question: esc } : void 0;
  let action;
  if (r.action === "ask" || r.action === "offer" || r.action === "escalate" || r.action === "close") {
    action = r.action;
  } else {
    action = question ? "ask" : offer ? "offer" : escalate ? "escalate" : "close";
  }
  if (action === "ask" && (questionsAsked >= LIGHT_MAX_QUESTIONS || !question)) {
    action = offer ? "offer" : "close";
  }
  if (action === "offer" && !offer) action = escalate ? "escalate" : "close";
  if (action === "escalate" && !escalate) action = offer ? "offer" : "close";
  const mirror = action === "ask" || action === "offer" || action === "close" ? stripTrailingQuestion(rawMirror) : rawMirror;
  return {
    mirror,
    action,
    ...action === "ask" ? { question } : {},
    ...action === "offer" && offer ? { offer } : {},
    ...action === "escalate" && escalate ? { escalate } : {}
  };
}
async function runLightGate(problemText, locale, signal) {
  const text = (problemText || "").trim();
  if (!text) return { need: "heavy" };
  const crisis = classifyCrisis(text);
  if (crisis.isCrisis && crisis.category) return { need: "heavy" };
  try {
    const raw = await callLLMJson(
      [{ role: "user", content: buildLightGateUserPrompt(text, locale) }],
      {
        system: buildLightSystemPrompt(locale, "gate"),
        model: "fast",
        maxTokens: 500,
        signal,
        shape: { need: "string" }
      }
    );
    return coerceLightGate(raw);
  } catch (err) {
    const category = err?.category;
    const message = err instanceof Error ? err.message : "";
    if (category === "rate_limit" || category === "auth" && message.startsWith("LOGIN_REQUIRED")) {
      try {
        track("light_gate_quota_fallback");
      } catch {
      }
    }
    return { need: "heavy" };
  }
}
var STATED_DECISION = /[가-힣]기로\s*(?:했|정했)|결정했|할래|살래|갈래|보낼래|버릴래|\bgoing\s+to\s|\bdecided\s+to\s|\bi'?ll\s/i;
var ASK_PRESUMES_OUTCOME = new RegExp(
  "(\uD588|\uD558\uAE30\uB85C|\uAC00\uAE30\uB85C|\uC0AC\uAE30\uB85C|\uBCF4\uB0B4\uAE30\uB85C|\uC77C\uCC0D|\uB05D\uAE4C\uC9C0|\uC548\\s*\uD558\uAE30\uB85C)\\s*(?:\uD588|\uD55C|\uD558\uC2E0|\uD558\uAE30\uB85C)|\uAC78\uB85C\\s*\uD558(?:\uACE0|\uC8E0|\uC790|\uC2DC)|\uAC83\uC73C\uB85C\\s*\uD558(?:\uACE0|\uC8E0)|\\b(?:you|i)\\s+(?:stayed|left|went|bought|took|skipped|declined)\\b|\\blet.?s\\s+(?:go with|say)\\b",
  "i"
);
var ASK_IS_NEUTRAL = /어떻게\s*(?:됐|하셨|되셨)|how\s+it\s+(?:went|turned)|what\s+(?:you\s+)?(?:did|ended)/i;
function neutralizeUndecidedAsk(turn, problemText, qas) {
  const ask = turn.offer?.ask;
  if (!ask) return turn;
  const userTexts = [problemText, ...qas.map((qa) => qa.answer || "")];
  const userDecided = userTexts.some((t) => STATED_DECISION.test(t || ""));
  if (userDecided) return turn;
  if (ASK_IS_NEUTRAL.test(ask) && !ASK_PRESUMES_OUTCOME.test(ask)) return turn;
  const { ask: _dropped, ...offer } = turn.offer;
  void _dropped;
  return { ...turn, offer };
}
async function runLightNext(problemText, qas, locale, signal) {
  const answersText = qas.map((qa) => qa.answer || "").join("  ");
  const crisis = classifyCrisis(answersText);
  if (crisis.isCrisis && crisis.category) {
    return { mirror: "", action: "close", crisis };
  }
  const raw = await callLLMJson(
    [{ role: "user", content: buildLightNextUserPrompt(problemText, qas, locale) }],
    {
      system: buildLightSystemPrompt(locale, "next", qas.length),
      model: "fast",
      maxTokens: 700,
      signal,
      shape: { mirror: "string", action: "string" }
    }
  );
  const userTexts = [problemText, ...qas.map((qa) => qa.answer || "")];
  return neutralizeUndecidedAsk(coerceLightTurn(raw, qas.length, userTexts), problemText, qas);
}
function lightWhenLabel(when, days, locale) {
  const ko2 = locale === "ko";
  switch (when) {
    case "tonight":
      return ko2 ? "\uC624\uB298 \uBC24 9\uC2DC" : "tonight at 9";
    case "tomorrow_morning":
      return ko2 ? "\uB0B4\uC77C \uC544\uCE68" : "tomorrow morning";
    case "this_weekend":
      return ko2 ? "\uC774\uBC88 \uC8FC \uC77C\uC694\uC77C" : "this Sunday";
    case "in_days": {
      const n = clampLightDays(days) ?? LIGHT_DAYS_MIN;
      return ko2 ? `${n}\uC77C \uB4A4` : `in ${n} day${n === 1 ? "" : "s"}`;
    }
  }
}
function composeDeepenText(problemText, qas, locale, escalation) {
  const ko2 = locale === "ko";
  const text = (problemText || "").trim();
  const parts = [text];
  if (qas.length) {
    const header = ko2 ? "\uAC00\uBCCD\uAC8C \uBA3C\uC800 \uB098\uB208 \uBB38\uB2F5:" : "Notes from a quick first pass:";
    const lines = qas.map((qa) => `Q. ${qa.question.trim()}
A. ${qa.answer.trim()}`).join("\n");
    parts.push(`${header}
${lines}`);
  }
  if (escalation) {
    const bq = (escalation.biggerQuestion || "").trim();
    parts.push(
      ko2 ? `${bq ? `\uD568\uAED8 \uC9DA\uC740 \uB354 \uD070 \uC9C8\uBB38: ${bq}
` : ""}(\uBC29\uAE08 '\uB354 \uAE4A\uC774 \uBCF4\uAE30'\uB97C \uC9C1\uC811 \uC120\uD0DD\uD574 \uC774 \uC9C8\uBB38\uC744 \uC5F4\uC5B4 \uBCF4\uAE30\uB85C \uD588\uC2B5\uB2C8\uB2E4.)` : `${bq ? `The bigger question we named: ${bq}
` : ""}(The user just chose to open this question up and look deeper.)`
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

// src/lib/compact-context.ts
var LABELS = {
  ko: {
    previousRounds: "[\uC774\uC804 \uB77C\uC6B4\uB4DC \uC694\uC57D]",
    recentConversation: "[\uCD5C\uADFC \uB300\uD654]",
    noAnalysis: "(\uBD84\uC11D \uC5C6\uC74C)",
    insightFlow: "[\uC778\uC0AC\uC774\uD2B8 \uD750\uB984]",
    realQuestion: "\uC9C4\uC9DC \uC9C8\uBB38",
    hiddenAssumptions: "\uC228\uACA8\uC9C4 \uC804\uC81C",
    skeleton: "\uBF08\uB300",
    executionPlan: "\uC2E4\uD589\uACC4\uD68D",
    latestInsight: "\uCD5C\uC2E0 \uC778\uC0AC\uC774\uD2B8",
    committedDirection: "\uC0AC\uC6A9\uC790\uAC00 \uD0DD\uD55C \uBC29\uD5A5",
    nextThreeDays: "\uC0AC\uC6A9\uC790\uAC00 \uC815\uD55C 3\uC77C \uACC4\uD68D"
  },
  en: {
    previousRounds: "[Previous rounds \u2014 summarized]",
    recentConversation: "[Recent conversation]",
    noAnalysis: "(no analysis yet)",
    insightFlow: "[Insight flow]",
    realQuestion: "Real question",
    hiddenAssumptions: "Hidden assumptions",
    skeleton: "Skeleton",
    executionPlan: "Execution plan",
    latestInsight: "Latest insight",
    committedDirection: "Direction the user committed to",
    nextThreeDays: "User's chosen 3-day plan"
  }
};
function extractCaveats(answer) {
  const patterns = [
    // 한국어 조건절
    /(?:단,|다만|단지|만약|다만,)\s*[^.!?\n]+/g,
    /(?:~인 경우|~일 때|~하면|~한다면)[^.!?\n]*/g,
    /(?:조건은|전제는|단서는)[^.!?\n]+/g,
    // 영어 조건절
    /(?:but |however |only if |unless |provided that |as long as )[^.!?\n]+/gi
  ];
  const caveats = [];
  for (const pattern of patterns) {
    const matches = answer.match(pattern);
    if (matches) {
      for (const m of matches) {
        const trimmed = m.trim();
        if (trimmed.length > 5 && !caveats.includes(trimmed)) {
          caveats.push(trimmed);
        }
      }
    }
  }
  return caveats.slice(0, 2);
}
function summarizeBySentence(text, maxSentences = 2) {
  const sentences = text.match(/[^.!?。]+[.!?。]+/g);
  if (!sentences || sentences.length === 0) {
    return text.length > 150 ? text.slice(0, 150) + "..." : text;
  }
  const selected = sentences.slice(0, maxSentences);
  const result = selected.join("").trim();
  if (result.length > 150 && sentences.length > 1) {
    return sentences[0].trim();
  }
  return result;
}
function compactQAHistory(questionsAndAnswers, keepRecent = 2, locale = "ko") {
  const L = LABELS[locale];
  if (questionsAndAnswers.length <= keepRecent) {
    return questionsAndAnswers.map(
      (qa, i) => `Q${i + 1}: ${qa.question.text}
A${i + 1}: ${qa.answer.value}`
    ).join("\n\n");
  }
  const older = questionsAndAnswers.slice(0, -keepRecent);
  const recent = questionsAndAnswers.slice(-keepRecent);
  const recentStartIndex = older.length;
  const compactedOlder = older.map((qa, i) => {
    const answer = qa.answer.value;
    const summary = summarizeBySentence(answer, 2);
    const caveats = extractCaveats(answer);
    let line = `[R${i + 1}] ${qa.question.text} \u2192 ${summary}`;
    if (caveats.length > 0) {
      line += `
     \u26A0\uFE0F ${caveats[0]}`;
    }
    return line;
  }).join("\n");
  const fullRecent = recent.map((qa, i) => {
    const idx = recentStartIndex + i + 1;
    return `Q${idx}: ${qa.question.text}
A${idx}: ${qa.answer.value}`;
  }).join("\n\n");
  return `${L.previousRounds}
${compactedOlder}

${L.recentConversation}
${fullRecent}`;
}
function getKeepRecent(round) {
  return round >= 3 ? 3 : 2;
}
function compactSnapshots(snapshots, locale = "ko") {
  const L = LABELS[locale];
  if (snapshots.length <= 1) {
    const s = snapshots[0];
    if (!s) return L.noAnalysis;
    return formatSnapshot(s, locale);
  }
  const latest = snapshots[snapshots.length - 1];
  const previousInsights = snapshots.slice(0, -1).filter((s) => s.insight).map((s, i) => `v${i}: ${s.insight}`).join(" \u2192 ");
  const lines = [formatSnapshot(latest, locale)];
  if (previousInsights) {
    lines.push(`${L.insightFlow} ${previousInsights}`);
  }
  return lines.join("\n");
}
var MIX_CONTEXT_FIELDS = [
  "real_question",
  "hidden_assumptions",
  "skeleton",
  "insight",
  "decision_line",
  "next_three_days"
];
var MIX_RENDERERS = {
  real_question: (s, L) => `- ${L.realQuestion}: ${s.real_question}`,
  hidden_assumptions: (s, L) => `- ${L.hiddenAssumptions}: ${s.hidden_assumptions.join(" / ")}`,
  skeleton: (s, L) => `- ${L.skeleton}: ${s.skeleton.join(" \u2192 ")}`,
  insight: (s, L) => s.insight ? `- ${L.latestInsight}: ${s.insight}` : null,
  // The user's OWN chosen decision from a strategic_fork / weakness_check — the
  // sharpest artifact of their judgment (F1). Omitted only when genuinely empty.
  decision_line: (s, L) => s.decision_line?.trim() ? `- ${L.committedDirection}: ${s.decision_line.trim()}` : null,
  next_three_days: (s, L) => s.next_three_days && s.next_three_days.length > 0 ? `- ${L.nextThreeDays}: ${s.next_three_days.join(" / ")}` : null
};
function formatSnapshot(s, locale = "ko") {
  const L = LABELS[locale];
  const lines = [];
  for (const field of MIX_CONTEXT_FIELDS) {
    const line = MIX_RENDERERS[field](s, L);
    if (line != null) lines.push(line);
    if (field === "skeleton" && s.execution_plan) {
      lines.push(`- ${L.executionPlan}: ${s.execution_plan.steps.map((st) => st.task).join(" \u2192 ")}`);
    }
  }
  return lines.join("\n");
}
function estimateTokens(text) {
  return Math.ceil(text.length / 2.5);
}
function shouldCompact(questionsAndAnswers, maxTokenBudget = 3e3) {
  const raw = questionsAndAnswers.map(
    (qa) => qa.question.text + qa.answer.value
  ).join("");
  return estimateTokens(raw) > maxTokenBudget;
}

// src/lib/worker-personas.ts
var BUILTIN_PERSONAS = [
  {
    id: "researcher",
    name: "\uB2E4\uC740",
    nameEn: "Sophie",
    role: "\uB9AC\uC11C\uCE58 \uC560\uB110\uB9AC\uC2A4\uD2B8",
    roleEn: "Research Analyst",
    emoji: "\u{1F50D}",
    expertise: "\uC790\uB8CC \uC870\uC0AC, \uC2DC\uC7A5 \uBD84\uC11D, \uB370\uC774\uD130 \uC218\uC9D1\uC5D0 \uAC15\uD569\uB2C8\uB2E4. \uBE60\uC9D0\uC5C6\uC774 \uAF3C\uAF3C\uD558\uAC8C \uCC3E\uC544\uB0C5\uB2C8\uB2E4.",
    expertiseEn: "Strong at desk research, market analysis, and data gathering. Thorough and exhaustive.",
    tone: "\uD329\uD2B8 \uC911\uC2EC\uC73C\uB85C \uAC04\uACB0\uD558\uAC8C, \uCD9C\uCC98\uB97C \uBA85\uC2DC\uD558\uBA70 \uC2E0\uB8B0\uAC10 \uC788\uAC8C \uC815\uB9AC\uD569\uB2C8\uB2E4.",
    toneEn: "Fact-first, concise, cites sources for credibility.",
    color: "#3B82F6"
  },
  {
    id: "strategist",
    name: "\uD604\uC6B0",
    nameEn: "Nathan",
    role: "\uC804\uB7B5\uAC00",
    roleEn: "Strategist",
    emoji: "\u{1F3AF}",
    expertise: "\uC804\uB7B5 \uC218\uB9BD, \uD3EC\uC9C0\uC154\uB2DD, \uACBD\uC7C1 \uBD84\uC11D\uC758 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uD070 \uADF8\uB9BC\uC744 \uADF8\uB9BD\uB2C8\uB2E4.",
    expertiseEn: "Expert in strategy formulation, positioning, and competitive analysis. Draws the big picture.",
    tone: "\uD575\uC2EC\uB9CC \uC9DA\uB418, \uC65C \uADF8\uB7F0\uC9C0 \uD55C \uC904\uB85C \uC124\uB4DD\uB825 \uC788\uAC8C \uC124\uBA85\uD569\uB2C8\uB2E4.",
    toneEn: "Hits the core points and explains why in a single persuasive line.",
    color: "#8B5CF6"
  },
  {
    id: "numbers",
    name: "\uADDC\uBBFC",
    nameEn: "Ethan",
    role: "\uC22B\uC790 \uBD84\uC11D\uAC00",
    roleEn: "Numbers Analyst",
    emoji: "\u{1F4CA}",
    expertise: "\uC218\uCE58 \uBD84\uC11D, \uC7AC\uBB34 \uBAA8\uB378\uB9C1, ROI \uACC4\uC0B0\uC5D0 \uB2A5\uD569\uB2C8\uB2E4. \uC22B\uC790\uB85C \uC774\uC57C\uAE30\uD569\uB2C8\uB2E4.",
    expertiseEn: "Skilled at quantitative analysis, financial modeling, and ROI calculation. Speaks with numbers.",
    tone: "\uC815\uB7C9\uC801 \uADFC\uAC70\uB97C \uBA3C\uC800 \uC81C\uC2DC\uD558\uACE0, \uD574\uC11D\uC744 \uB367\uBD99\uC785\uB2C8\uB2E4. \uD45C\uC640 \uC218\uCE58\uB97C \uC801\uADF9 \uD65C\uC6A9\uD569\uB2C8\uB2E4.",
    toneEn: "Leads with quantitative evidence, adds interpretation. Uses tables and figures liberally.",
    color: "#10B981"
  },
  {
    id: "copywriter",
    name: "\uC11C\uC5F0",
    nameEn: "Claire",
    role: "\uCE74\uD53C\uB77C\uC774\uD130",
    roleEn: "Copywriter",
    emoji: "\u270D\uFE0F",
    expertise: "\uBB38\uC11C \uC791\uC131, \uCE74\uD53C\uB77C\uC774\uD305, \uBA54\uC2DC\uC9C0 \uC124\uACC4\uC758 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uC77D\uD788\uB294 \uAE00\uC744 \uC501\uB2C8\uB2E4.",
    expertiseEn: "Expert in document writing, copywriting, and message design. Writes prose that reads easily.",
    tone: "\uB3C5\uC790 \uAD00\uC810\uC5D0\uC11C \uC4F0\uACE0, \uD55C \uBB38\uC7A5\uC774 \uD558\uB098\uC758 \uBA54\uC2DC\uC9C0\uB97C \uC804\uB2EC\uD558\uB3C4\uB85D \uB2E4\uB4EC\uC2B5\uB2C8\uB2E4.",
    toneEn: "Writes from the reader's perspective; one sentence, one message.",
    color: "#F59E0B"
  },
  {
    id: "critic",
    name: "\uB3D9\uD601",
    nameEn: "Blake",
    role: "\uB9AC\uC2A4\uD06C \uAC80\uD1A0\uC790",
    roleEn: "Risk Reviewer",
    emoji: "\u26A0\uFE0F",
    expertise: "\uB9AC\uC2A4\uD06C \uBD84\uC11D, \uBC18\uB860 \uAC80\uD1A0, \uC57D\uC810 \uD30C\uC545\uC758 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uB193\uCE58\uAE30 \uC26C\uC6B4 \uAC78 \uCC3E\uC2B5\uB2C8\uB2E4.",
    expertiseEn: "Expert in risk analysis, counterarguments, and weak-spot detection. Catches what others miss.",
    tone: '\uC9C1\uC124\uC801\uC774\uC9C0\uB9CC \uAC74\uC124\uC801\uC73C\uB85C, "\uC774\uAC74 \uC704\uD5D8\uD558\uB2E4" \uB2E4\uC74C\uC5D0 \uBC18\uB4DC\uC2DC "\uB300\uC2E0 \uC774\uB807\uAC8C"\uB97C \uC81C\uC2DC\uD569\uB2C8\uB2E4.',
    toneEn: 'Direct but constructive \u2014 every "this is risky" is followed by "try this instead."',
    color: "#EF4444"
  },
  {
    id: "ux",
    name: "\uC9C0\uC740",
    nameEn: "Maya",
    role: "UX \uC124\uACC4\uC790",
    roleEn: "UX Designer",
    emoji: "\u{1F3A8}",
    expertise: "\uC0AC\uC6A9\uC790 \uACBD\uD5D8, \uC778\uD130\uD398\uC774\uC2A4 \uC124\uACC4, \uC0AC\uC6A9\uC131 \uD3C9\uAC00\uC5D0 \uAC15\uD569\uB2C8\uB2E4.",
    expertiseEn: "Strong at user experience, interface design, and usability evaluation.",
    tone: "\uC0AC\uC6A9\uC790 \uC785\uC7A5\uC5D0\uC11C \uC0DD\uAC01\uD558\uACE0, \uAD6C\uCCB4\uC801\uC778 \uC2DC\uB098\uB9AC\uC624\uB85C \uC124\uBA85\uD569\uB2C8\uB2E4.",
    toneEn: "Thinks from the user's perspective, explains with concrete scenarios.",
    color: "#EC4899"
  },
  {
    id: "legal",
    name: "\uC724\uC11D",
    nameEn: "Arthur",
    role: "\uBC95\uB960\xB7\uADDC\uC815 \uAC80\uD1A0\uC790",
    roleEn: "Legal Reviewer",
    emoji: "\u2696\uFE0F",
    expertise: "\uBC95\uC801 \uB9AC\uC2A4\uD06C, \uADDC\uC815 \uC900\uC218, \uACC4\uC57D \uC870\uAC74 \uAC80\uD1A0\uC5D0 \uB2A5\uD569\uB2C8\uB2E4.",
    expertiseEn: "Skilled at legal risk, compliance, and contract review.",
    tone: "\uBA85\uD655\uD558\uACE0 \uBCF4\uC218\uC801\uC73C\uB85C, \uAC00\uB2A5/\uBD88\uAC00\uB2A5\uC744 \uD655\uC2E4\uD788 \uAD6C\uBD84\uD569\uB2C8\uB2E4.",
    toneEn: "Clear and conservative; draws firm lines between what is and isn't allowed.",
    color: "#6B7280"
  },
  {
    id: "intern",
    name: "\uD558\uC724",
    nameEn: "Riley",
    role: "\uB9AC\uC11C\uCE58 \uC778\uD134",
    roleEn: "Research Intern",
    emoji: "\u{1F4DD}",
    expertise: "\uAE30\uCD08 \uC790\uB8CC \uC815\uB9AC, \uBCA4\uCE58\uB9C8\uD0B9, \uC0AC\uB840 \uC218\uC9D1\uC744 \uB2F4\uB2F9\uD569\uB2C8\uB2E4. \uC5F4\uC815\uC801\uC73C\uB85C \uCC3E\uC544\uC635\uB2C8\uB2E4.",
    expertiseEn: "Handles basic research, benchmarking, and case collection. Enthusiastic and thorough.",
    tone: "\uACF5\uC190\uD558\uACE0 \uC5F4\uC2EC\uD788, \uCC3E\uC740 \uAC83\uC744 \uBE60\uC9D0\uC5C6\uC774 \uC815\uB9AC\uD574\uC11C \uBCF4\uACE0\uD569\uB2C8\uB2E4.",
    toneEn: "Polite and eager; reports everything found without omission.",
    color: "#06B6D4"
  },
  {
    id: "engineer",
    name: "\uC900\uC11C",
    nameEn: "Leo",
    role: "\uAE30\uC220 \uC124\uACC4\uC790",
    roleEn: "Engineer",
    emoji: "\u2699\uFE0F",
    expertise: "\uAE30\uC220 \uC544\uD0A4\uD14D\uCC98, \uAD6C\uD604 \uAC00\uB2A5\uC131 \uAC80\uD1A0, \uC2DC\uC2A4\uD15C \uC124\uACC4\uC5D0 \uAC15\uD569\uB2C8\uB2E4.",
    expertiseEn: "Strong at technical architecture, feasibility review, and system design.",
    tone: "\uAD6C\uC870\uC801\uC73C\uB85C \uC815\uB9AC\uD558\uACE0, \uD2B8\uB808\uC774\uB4DC\uC624\uD504\uB97C \uBA85\uD655\uD788 \uC81C\uC2DC\uD569\uB2C8\uB2E4.",
    toneEn: "Structures thinking and states trade-offs clearly.",
    color: "#14B8A6"
  },
  {
    id: "pm",
    name: "\uC608\uB9B0",
    nameEn: "Grace",
    role: "PM",
    roleEn: "PM",
    emoji: "\u{1F4CB}",
    expertise: "\uC77C\uC815 \uAD00\uB9AC, \uC774\uD574\uAD00\uACC4\uC790 \uC870\uC728, \uC2E4\uD589 \uACC4\uD68D \uC218\uB9BD\uC5D0 \uB2A5\uD569\uB2C8\uB2E4.",
    expertiseEn: "Skilled at scheduling, stakeholder alignment, and execution planning.",
    tone: "\uC561\uC158 \uC544\uC774\uD15C \uC911\uC2EC\uC73C\uB85C, \uB204\uAC00\xB7\uC5B8\uC81C\xB7\uBB58 \uD574\uC57C \uD558\uB294\uC9C0 \uBA85\uD655\uD558\uAC8C \uC815\uB9AC\uD569\uB2C8\uB2E4.",
    toneEn: "Action-item focused; crisp on who, when, and what.",
    color: "#A855F7"
  },
  {
    id: "finance",
    name: "\uD61C\uC5F0",
    nameEn: "Diana",
    role: "\uC7AC\uBB34\xB7\uD68C\uACC4 \uC804\uBB38\uAC00",
    roleEn: "Finance & Accounting",
    emoji: "\u{1F4B0}",
    expertise: "\uC7AC\uBB34 \uACC4\uD68D, \uD22C\uC790 \uD310\uB2E8, \uD604\uAE08\uD750\uB984 \uBD84\uC11D, \uC790\uAE08 \uC870\uB2EC \uC804\uB7B5\uC5D0 \uAE4A\uC774\uAC00 \uC788\uC2B5\uB2C8\uB2E4.",
    expertiseEn: "Deep expertise in financial planning, investment decisions, cash flow analysis, and capital strategy.",
    tone: "\uBCF4\uC218\uC801 \uAE30\uC900\uC120\uACFC \uB099\uAD00\uC801 \uC2DC\uB098\uB9AC\uC624\uB97C \uD568\uAED8 \uC81C\uC2DC\uD558\uACE0, \uAC00\uC815\uC774 \uBB34\uB108\uC9C0\uB294 \uC9C0\uC810\uC744 \uBA85\uC2DC\uD569\uB2C8\uB2E4.",
    toneEn: "Presents conservative baseline and optimistic scenarios together, and flags where the assumptions break.",
    color: "#059669"
  },
  {
    id: "marketing",
    name: "\uBBFC\uC11C",
    nameEn: "Stella",
    role: "\uB9C8\uCF00\uD305\xB7\uADF8\uB85C\uC2A4 \uC804\uB7B5\uAC00",
    roleEn: "Marketing & Growth",
    emoji: "\u{1F4E3}",
    expertise: "\uC2DC\uC7A5 \uD3EC\uC9C0\uC154\uB2DD, \uBE0C\uB79C\uB4DC \uBA54\uC2DC\uC9C0, \uCC44\uB110 \uC804\uB7B5, \uACE0\uAC1D \uD68D\uB4DD \uD37C\uB110 \uC124\uACC4\uC5D0 \uB2A5\uD569\uB2C8\uB2E4.",
    expertiseEn: "Skilled at positioning, brand messaging, channel strategy, and acquisition funnel design.",
    tone: "\uD0C0\uAC9F\uACFC \uBA54\uC2DC\uC9C0\uB97C \uAD6C\uCCB4\uC801\uC73C\uB85C \uC5F0\uACB0\uD558\uACE0, \uCE21\uC815 \uAC00\uB2A5\uD55C \uC9C0\uD45C\uB85C \uC774\uC57C\uAE30\uD569\uB2C8\uB2E4.",
    toneEn: "Ties target audience to message concretely and speaks in measurable metrics.",
    color: "#E11D48"
  },
  {
    id: "people_culture",
    name: "\uC218\uC9C4",
    nameEn: "Harper",
    role: "\uC0AC\uB78C\xB7\uBB38\uD654 \uC804\uB7B5\uAC00",
    roleEn: "People & Culture Strategist",
    emoji: "\u{1F91D}",
    expertise: "\uC870\uC9C1 \uC124\uACC4, \uCC44\uC6A9 \uC804\uB7B5, \uBB38\uD654 \uD615\uC131, \uD300 \uAC08\uB4F1 \uD574\uACB0\uC5D0 \uAE4A\uC774\uAC00 \uC788\uC2B5\uB2C8\uB2E4.",
    expertiseEn: "Deep expertise in org design, hiring strategy, culture building, and team conflict resolution.",
    tone: "\uC0AC\uB78C \uC785\uC7A5\uC744 \uBA3C\uC800 \uC77D\uACE0, \uAD6C\uC870\uC801 \uD574\uBC95\uACFC \uB2E8\uAE30 \uC2E4\uD589\uC744 \uD568\uAED8 \uC81C\uC548\uD569\uB2C8\uB2E4.",
    toneEn: "Reads people's perspective first, then proposes both structural solutions and short-term actions.",
    color: "#F472B6"
  },
  {
    id: "research_director",
    name: "\uB3C4\uC724",
    nameEn: "Marcus",
    role: "\uB9AC\uC11C\uCE58 \uB514\uB809\uD130",
    roleEn: "Research Director",
    emoji: "\u{1F9E0}",
    expertise: "\uC5EC\uB7EC \uB9AC\uC11C\uCE58 \uACB0\uACFC\uB97C \uAD50\uCC28 \uBD84\uC11D\uD558\uACE0 \uD575\uC2EC \uC778\uC0AC\uC774\uD2B8\uB97C \uBF51\uC544\uB0C5\uB2C8\uB2E4.",
    expertiseEn: "Cross-analyzes multiple research outputs and distills the key insights.",
    tone: "\uD070 \uADF8\uB9BC\uACFC \uC138\uBD80 \uB370\uC774\uD130\uB97C \uC5F0\uACB0\uD558\uBA70, \uAC00\uC7A5 \uC911\uC694\uD55C \uBC1C\uACAC\uC744 \uC55E\uC5D0 \uB0B4\uC138\uC6C1\uB2C8\uB2E4.",
    toneEn: "Connects the big picture with detail and leads with the most important finding.",
    color: "#1D4ED8"
  },
  {
    id: "strategy_jr",
    name: "\uC815\uBBFC",
    nameEn: "Alex",
    role: "\uC804\uB7B5 \uC8FC\uB2C8\uC5B4",
    roleEn: "Junior Strategist",
    emoji: "\u{1F4D1}",
    expertise: "\uC635\uC158 \uBE44\uAD50\uD45C \uC791\uC131, \uAE30\uCD08 \uBCA4\uCE58\uB9C8\uD0B9, \uC804\uB7B5 \uCD08\uC548 \uC815\uB9AC\uB97C \uB2F4\uB2F9\uD569\uB2C8\uB2E4.",
    expertiseEn: "Builds option comparison tables, baseline benchmarks, and strategy drafts.",
    tone: "\uAD6C\uC870\uC801\uC73C\uB85C \uC815\uB9AC\uD558\uB418, \uACB0\uB860\uC744 \uC123\uBD88\uB9AC \uB0B4\uC9C0 \uC54A\uACE0 \uC120\uD0DD\uC9C0\uB97C \uD22C\uBA85\uD558\uAC8C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.",
    toneEn: "Structured but holds off on premature conclusions; surfaces options transparently.",
    color: "#C4B5FD"
  },
  {
    id: "chief_strategist",
    name: "\uC2B9\uD604",
    nameEn: "Victor",
    role: "\uC218\uC11D \uC804\uB7B5\uAC00",
    roleEn: "Chief Strategist",
    emoji: "\u265F\uFE0F",
    expertise: "\uC2DC\uB098\uB9AC\uC624 \uC124\uACC4, \uC758\uC0AC\uACB0\uC815 \uAD6C\uC870, \uAD8C\uC7A5 \uACBD\uB85C \uC120\uD0DD\uAE4C\uC9C0 \uCC45\uC784\uC9D1\uB2C8\uB2E4.",
    expertiseEn: "Owns scenario design, decision structure, and recommended-path selection.",
    tone: "\uD655\uC2E0\uACFC \uC720\uBCF4\uB97C \uAD6C\uBD84\uD574\uC11C \uB9D0\uD558\uACE0, \uC65C \uC774 \uACBD\uB85C\uC778\uC9C0 \uD55C \uBB38\uB2E8\uC73C\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.",
    toneEn: "Separates conviction from reservation and justifies the chosen path in one paragraph.",
    color: "#6D28D9"
  },
  {
    id: "navigator",
    name: "\uC885\uD569\uC790",
    nameEn: "Synthesizer",
    role: "\uC885\uD569 \uAC80\uD1A0\uC790",
    roleEn: "Chief Reviewer",
    emoji: "\u{1F9ED}",
    expertise: "\uD300 \uC804\uCCB4 \uACB0\uACFC\uBB3C\uC744 \uD1B5\uD569 \uAC80\uD1A0\uD558\uACE0, \uD1A4\uACFC \uB17C\uB9AC\uC758 \uC77C\uAD00\uC131\uC744 \uB9DE\uCDA5\uB2C8\uB2E4.",
    expertiseEn: "Integrates the team's outputs and aligns tone and logical consistency across the work.",
    tone: "\uAC1C\uBCC4 \uC758\uACAC\uC744 \uC874\uC911\uD558\uB418, \uC804\uCCB4\uAC00 \uD55C \uBAA9\uC18C\uB9AC\uB85C \uC77D\uD788\uB3C4\uB85D \uD3B8\uC9D1\uD569\uB2C8\uB2E4.",
    toneEn: "Respects individual voices but edits so the whole reads as one.",
    color: "#D97706"
  }
];
var BUILTIN_IDS = new Set(BUILTIN_PERSONAS.map((p) => p.id));

// src/lib/question-rules.ts
var GLOBAL_QUESTION_INSTRUCTION = {
  ko: [
    "\uB2F9\uC2E0\uC758 \uC784\uBB34\uB294 \uC815\uBCF4 \uC218\uC9D1\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uC758 \uD310\uB2E8\uC744 \uBC14\uAFB8\uB294 \uC804\uC81C\uB098 \uAC08\uB9BC\uAE38 \uD558\uB098\uB97C \uB4DC\uB7EC\uB0B4\uB294 \uAC83\uC785\uB2C8\uB2E4.",
    '\uC808\uB300 \uBB3B\uC9C0 \uB9C8\uC138\uC694: \uCD5C\uC885 \uACB0\uC815\uAD8C\uC790, \uB9C8\uAC10/\uD615\uC2DD/\uD1A4, \uCC44\uC6B8 \uC139\uC158, "\uC774\uAC8C \uB9DE\uB098\uC694"(\uD655\uC778 \uC694\uAD6C).',
    '\uC0AC\uC6A9\uC790 \uC790\uC2E0\uC758 \uD45C\uD604\uC744 \uB530\uB77C\uAC00\uC138\uC694 \u2014 "\uBA39\uD790\uC9C0 \uBAA8\uB974\uACA0\uB2E4"\uACE0 \uD588\uC73C\uBA74 "\uBA39\uD78C\uB2E4"\uAC00 \uBB34\uC2A8 \uB73B\uC778\uC9C0 \uD30C\uACE0\uB4DC\uC138\uC694. "\uC2DC\uC7A5 \uAC80\uC99D"\uC73C\uB85C \uBC88\uC5ED\uD558\uC9C0 \uB9C8\uC138\uC694.',
    '\uC9C8\uBB38\uC740 \uC911\uB9BD\uC801\uC778 crux \uC9C8\uBB38\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4. \uAE30\uC6B8\uC778 \uC9C4\uC220("~\uD558\uB294 \uAC8C \uB0AB\uC9C0 \uC54A\uC744\uAE4C\uC694")\uB3C4, \uD0DC\uADF8 \uBD99\uC778 \uD3C9\uACB0("\uC81C \uD310\uB2E8\uC740 \uC544\uB2C8\uC9C0\uB9CC ~\uCABD")\uB3C4 \uAE08\uC9C0\uC785\uB2C8\uB2E4.'
  ].join(" "),
  en: [
    "Your job is not to collect information. Your job is to expose the one premise or fork that changes the user's judgment.",
    'Never ask: final decision-maker, deadline/format/tone, section-to-fill, "does this look right" (confirmation).',
    `Follow the user's own words \u2014 if they said it "might not land", interrogate what "landing" means; don't translate it into "market validation".`,
    `The question must be a neutral crux question. No tilted statements ("wouldn't it be safer to\u2026"), and no disclaimed verdicts ("not my call, but X leans\u2026").`
  ].join(" ")
};

// src/lib/prompt-voice.ts
var KOREAN_VOICE_RULES = `[\uB9D0\uD22C \u2014 \uD55C\uAD6D\uC5B4 \uCD9C\uB825 \uADDC\uCE59]
- \uC874\uB313\uB9D0(\uD574\uC694\uCCB4). \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uAD6C\uC5B4\uCCB4 \u2014 \uC810\uC2EC \uBA39\uC73C\uBA70 \uC598\uAE30\uD558\uB294 \uC120\uBC30\uCC98\uB7FC.
- \uBCF4\uACE0\uC11C \uD1A4, \uBC88\uC5ED\uD22C, AI \uB290\uB08C \uC808\uB300 \uAE08\uC9C0.
- \u2717 "\uC2E4\uD589 \uAC00\uB2A5\uC131\uC5D0 \uB300\uD55C \uC6B0\uB824\uAC00 \uC788\uC2B5\uB2C8\uB2E4" "\uAD6C\uC870\uC801 \uAC1C\uC120\uC774 \uD544\uC694\uD569\uB2C8\uB2E4"
- \u2717 "~\uD558\uB294 \uAC83\uC774 \uC694\uAD6C\uB429\uB2C8\uB2E4" "~\uB97C \uD1B5\uD574 \uC2DC\uB108\uC9C0\uB97C \uB3C4\uBAA8\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4"
- \u2713 "\uC774 \uC77C\uC815\uC73C\uB85C \uAC00\uB2A5\uD574\uC694? \uC7AC\uBB34\uD300 \uB370\uC774\uD130 \uBC1B\uB294 \uB370\uB9CC \uC77C\uC8FC\uC77C\uC778\uB370\uC694"
- \u2713 "\uC2DC\uC7A5 \uBD84\uC11D\uC740 \uC88B\uC740\uB370, \uC608\uC0B0 \uBD80\uBD84\uC774 \uC880 \uC57D\uD574\uC694. \uC791\uB144 \uC2E4\uC801 \uB123\uC73C\uBA74 \uBC14\uB85C \uB420 \uAC83 \uAC19\uC544\uC694"
- \uB0B4\uBD80 \uC6A9\uC5B4\uB97C \uC0AC\uC6A9\uC790 \uBB38\uC7A5\uC5D0 \uB178\uCD9C \uAE08\uC9C0: "\uC2A4\uCF08\uB808\uD1A4"/"\uC2A4\uB0C5\uC0F7"/"\uBBF9\uC2A4"/"\uD398\uC774\uC988"/"\uC6CC\uCEE4"\uB294
  \uC2DC\uC2A4\uD15C \uD544\uB4DC\uBA85\uC774\uB2E4 \u2014 \uC0AC\uC6A9\uC790 \uB9D0\uB85C\uB294 "\uACC4\uD68D"/"\uC9C0\uAE08\uAE4C\uC9C0\uC758 \uC815\uB9AC"/"\uCD5C\uC885 \uC815\uB9AC"\uB77C\uACE0 \uC4F4\uB2E4.
  \u2717 "\uC774\uAC8C \uC2A4\uCF08\uB808\uD1A4\uC758 \uB9AC\uC2A4\uD06C \uACC4\uC0B0 \uC804\uCCB4\uB97C \uBC14\uAFD4\uC694" \u2713 "\uC774\uAC8C \uACC4\uD68D \uC804\uCCB4\uC758 \uB9AC\uC2A4\uD06C \uACC4\uC0B0\uC744 \uBC14\uAFD4\uC694"
- \uAE08\uC9C0 \uC5B4\uD718 (\uCC3D\uC5C5\uC790 \uD655\uC815 \u2014 \uC0AC\uC6A9\uC790 \uBB38\uC7A5 \uC5B4\uB514\uC5D0\uB3C4 \uAE08\uC9C0): "\uBCA0\uD305"(\u2192 \uD310\uB2E8), "\uCD08\uC548"(\u2192 \uC815\uB9AC),
  "\uAC78\uC5B4\uB450\uB2E4". \uCF54\uB4DC\uAC00 \uAE30\uACC4\uB85C \uCE58\uD658\uD558\uC9C0\uB9CC \uCE58\uD658\uBB38\uC740 \uACB0\uC774 \uC5B4\uAE0B\uB09C\uB2E4 \u2014 \uCC98\uC74C\uBD80\uD130 \uC4F0\uC9C0 \uB9C8\uB77C.

[\uB418\uBE44\uCD94\uAE30 \u2014 \uC694\uC57D\uD558\uC9C0 \uB9D0\uACE0 \uC9DA\uC5B4\uB77C]
- \uC0AC\uC6A9\uC790\uAC00 \uC4F4 \uAC78 \uB2E4\uC2DC \uB098\uC5F4\uD558\uC9C0 \uB9C8\uB77C. \uB098\uC5F4\uC740 \uC811\uC218\uC99D\uC774\uACE0, \uB418\uBE44\uCD94\uAE30\uB294 **\uBB34\uC5C7 \uB54C\uBB38\uC5D0
  \uAC08\uB9AC\uB294\uC9C0**\uB97C \uADF8 \uC0AC\uB78C\uBCF4\uB2E4 \uC9E7\uAC8C \uB3CC\uB824\uC8FC\uB294 \uAC83\uC774\uB2E4.
- \uBB38\uC7A5\uC744 "~\uD558\uB294 \uC0C1\uD669\uC774\uC5D0\uC694 / ~\uC0C1\uD0DC\uC608\uC694 / ~\uC0C1\uD669\uC774\uB124\uC694"\uB85C \uB2EB\uC9C0 \uB9C8\uB77C. \uC2E4\uCE21\uC5D0\uC11C \uC5F4
  \uC904 \uC911 \uC544\uD649\uC774 \uC774 \uAF2C\uB9AC\uB85C \uB05D\uB0AC\uB2E4. \uD55C\uAD6D \uC0AC\uB78C\uC740 \uB0A8\uC758 \uACE0\uBBFC\uC744 \uB418\uBE44\uCD9C \uB54C \uC774\uB807\uAC8C \uB9D0\uD558\uC9C0
  \uC54A\uB294\uB2E4. \uC774 \uAF2C\uB9AC \uD558\uB098\uAC00 \uC804\uCCB4\uB97C \uC0AC\uBB34\uC801\uC73C\uB85C \uB9CC\uB4E0\uB2E4.
- \u2717 "\uC5F0\uBD09 40% \uC624\uD37C\uC640 \uB0B4\uB144 \uCD08 \uB9AC\uB4DC \uC2B9\uC9C4 \uAC00\uB2A5\uC131 \uC0AC\uC774\uC5D0\uC11C \uC77C\uC8FC\uC77C \uC548\uC5D0 \uB2F5\uC744 \uC918\uC57C \uD558\uB294 \uC0C1\uD669\uC774\uC5D0\uC694."
  \u2713 "\uC2B9\uC9C4\uC740 \uC544\uC9C1 \uB9D0\uBFD0\uC778\uB370, \uC624\uD37C\uB294 \uC77C\uC8FC\uC77C \uC548\uC5D0 \uB2F5\uC744 \uB2EC\uB77C\uACE0 \uD558\uB124\uC694."
- \u2717 "\uC9C0\uAE08 \uC4F0\uB294 \uB178\uD2B8\uBD81\uC774 5\uB144 \uB410\uACE0 \uBD80\uD305\uC774 \uC624\uB798 \uAC78\uB9AC\uB294 \uC0C1\uD669\uC774\uB124\uC694. \uC0C8\uB85C \uC0B4\uC9C0 \uB9D0\uC9C0\uAC00 \uAC78\uB824 \uC788\uACE0\uC694."
  \u2713 "5\uB144 \uC4F0\uC168\uACE0, \uC774\uC81C \uCF1C\uB294 \uAC83\uBD80\uD130 \uB2F5\uB2F5\uD558\uC2E0 \uAC70\uB124\uC694."
- \u2717 "\uAC1C\uC120 \uACC4\uD68D\uAE4C\uC9C0 \uD568\uAED8 \uC7A1\uC558\uB294\uB370\uB3C4 \uBCC0\uD654\uAC00 \uC5C6\uB294 \uD300\uC6D0\uC744 \uACC4\uC18D \uB370\uB824\uAC08\uC9C0, \uB0B4\uBCF4\uB0BC\uC9C0 \uACB0\uC815\uD574\uC57C \uD558\uB294 \uC0C1\uD669\uC774\uC5D0\uC694."
  \u2713 "\uACC4\uD68D\uAE4C\uC9C0 \uAC19\uC774 \uC138\uC6E0\uB294\uB370 \uC548 \uC6C0\uC9C1\uC600\uB124\uC694. \uADF8\uB798\uC11C \uB354 \uC5B4\uB824\uC6B0\uC2E0 \uAC70\uACE0\uC694."
- \uC88B\uC740 \uB418\uBE44\uCD94\uAE30\uC758 \uBCF8\uBCF4\uAE30 (\uC2E4\uC81C \uCD9C\uB825 \uC911 \uAC00\uC7A5 \uC0AC\uB78C\uB2E4\uC6E0\uB358 \uAC83):
  \u2713 "\uC9C0\uB09C\uB2EC\uC5D0 \uBABB \uAC00\uC168\uC73C\uB2C8\uAE4C \uC774\uBC88 \uC8FC\uB9D0\uC5D4 \uAC00\uC57C \uD558\uB294 \uAC70 \uC544\uB2CC\uAC00 \uC2F6\uC73C\uC2E0 \uAC70\uB124\uC694.
     \uADFC\uB370 \uAC00\uACE0 \uC2F6\uC73C\uC2E0 \uAC74\uC9C0, \uAC00\uC57C \uD55C\uB2E4\uB294 \uC0DD\uAC01\uC774 \uAC15\uD55C \uAC74\uC9C0\uB294 \uC544\uC9C1 \uC548 \uB4E4\uC5C8\uC5B4\uC694."
  \u2014 \uC0AC\uC2E4\uC744 \uC138\uC9C0 \uC54A\uACE0 \uB9C8\uC74C\uC758 \uAC08\uB798\uB97C \uC9DA\uC5C8\uACE0, \uBAA8\uB974\uB294 \uAC74 \uBAA8\uB978\uB2E4\uACE0 \uD588\uB2E4.
- \uC9E7\uC740 \uBB38\uC7A5\uC744 \uC368\uB77C. \uD55C \uBB38\uC7A5\uC5D0 "~\uACE0 / ~\uC778\uB370 / ~\uB77C\uC11C"\uB85C \uC138 \uAC00\uC9C0\uB97C \uC787\uC9C0 \uB9C8\uB77C.
- \uC0AC\uC6A9\uC790\uAC00 \uC4F4 \uB2E8\uC5B4\uB97C \uADF8\uB300\uB85C \uC368\uB77C. \uADF8\uB4E4\uC774 "\uBE61\uC138\uB2E4"\uB77C\uACE0 \uD588\uC73C\uBA74 "\uBD80\uB2F4\uC774 \uD06C\uC2DC\uAD70\uC694"\uB85C
  \uBC88\uC5ED\uD558\uC9C0 \uB9C8\uB77C.`;
var ARGUS_PRODUCT_FACTS = `ARGUS PRODUCT-FACT HONESTY:
- argus_predict saves to the local .argus directory by default. It does NOT, by itself, write directly into the Argus web workspace or arm account email.
- Web/account records and reminders require an explicit account bridge: ARGUS_TOKEN in MCP configuration, or an argus_settings connect/sync flow.
- Never invent, imply, or recommend an Argus integration behavior beyond those facts. If the user's task does not require product instructions, omit them entirely.`;

// src/lib/decisive-premises.ts
var KIND_POLICY = {
  // The required fields are per kind for the same reason the gates are. Asking
  // every proposal for a counterfactual meant the model could not file an
  // honest fact at all: told "if you cannot say what it licenses, record the
  // plain fact and stop", it did exactly that and was refused with
  // missing_required_field — twice in one measured run.
  fact: { verifiable: false, competes: false, needsClaim: false, needsStance: false, needsObservable: false, needsCounterfactual: false, needsSupportKind: false },
  premise: { verifiable: true, competes: true, needsClaim: true, needsStance: false, needsObservable: false, needsCounterfactual: true, needsSupportKind: true },
  // A prediction is NOT gated on saying something new. Its whole job is to turn
  // a hedge into something reality can answer — "올려달라고 할 것 같기도
  // 하고요" into "올려달라고 할 것이다" — which adds no vocabulary at all. What
  // it owes instead is a way to check it.
  prediction: { verifiable: true, competes: true, needsClaim: false, needsStance: false, needsObservable: true, needsCounterfactual: true, needsSupportKind: true },
  // "이게 틀리면 무엇이 달라지나요" about someone's own weighting is a question
  // nobody may ask them, so a standard never owes a counterfactual.
  standard: { verifiable: false, competes: false, needsClaim: false, needsStance: true, needsObservable: false, needsCounterfactual: false, needsSupportKind: true },
  open_question: { verifiable: true, competes: false, needsClaim: false, needsStance: false, needsObservable: false, needsCounterfactual: false, needsSupportKind: false }
};
var PREMISE_KINDS = Object.keys(KIND_POLICY);
function asKind(value) {
  const k = typeof value === "string" ? value.trim() : "";
  return PREMISE_KINDS.includes(k) ? k : "premise";
}
function policyFor(kind) {
  return KIND_POLICY[asKind(kind)];
}

// src/lib/premise-claim.ts
function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
function comparable(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
function isTraceableQuote(quote, userText) {
  const needle = comparable(quote);
  const haystack = comparable(userText);
  return needle.length > 0 && haystack.includes(needle);
}
var SUPPORT_KINDS = /* @__PURE__ */ new Set([
  "explicit_reason",
  "explicit_condition",
  "explicit_expectation"
]);
function hasExplicitSupportSignal(text) {
  const normalized = comparable(text);
  return /(때문|그래서|이라서|라서|으니까|니까|다면|라면|하면|이면|전제|기대|믿|것 같|거라|될 것|할 것|중요|기준|우선순위|우선|걸리|걸려|부담|불안|포기|조건|원하|바라)|\b(because|since|if|unless|expect|assume|believe|count on|depend|rely|matters?|important|likely|probably|worried|worries|concern|prefer|priority|trade-?off|give up)\b/i.test(normalized);
}
var STOP_TOKENS = /* @__PURE__ */ new Set([
  "\uADF8",
  "\uC774",
  "\uC800",
  "\uAC83",
  "\uC218",
  "\uB54C",
  "\uB4F1",
  "\uBC0F",
  "\uB354",
  "\uC880",
  "\uC798",
  "\uC548",
  "\uBABB",
  "\uB610",
  "\uB098",
  "\uB108",
  "\uB0B4",
  "\uC81C",
  "\uC800\uD76C",
  "\uC6B0\uB9AC",
  "\uAC70",
  "\uAC8C",
  "\uAC74",
  "\uC810",
  "\uBD84",
  "\uC911",
  "\uD6C4",
  "\uC804",
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "of",
  "to",
  "in",
  "on",
  "at",
  "is",
  "are",
  "be",
  "been",
  "that",
  "this",
  "it",
  "as",
  "for",
  "with",
  "my",
  "i",
  "we",
  "they",
  // Slot names. "런웨이가 18개월이라는 전제" is the anchor with the word
  // "전제" stapled on — the model naming the box it is filling, which the
  // harness prompt already calls out (✗ "같은 사실에 이름만 붙인 것"). Left
  // countable, these words were enough novelty to pass a restatement as a claim.
  "\uC804\uC81C",
  "\uAC00\uC815",
  "\uC870\uAC74",
  "\uBCC0\uC218",
  "\uC694\uC778",
  "\uB9AC\uC2A4\uD06C",
  "\uC774\uC288",
  "\uC9C0\uC810",
  "\uBD80\uBD84",
  "\uCE21\uBA74",
  "\uC0C1\uD669",
  "\uC0C1\uD0DC",
  "\uD3EC\uC778\uD2B8",
  "\uBB38\uC81C",
  "\uC0AC\uC2E4",
  "\uC598\uAE30",
  "\uC774\uC57C\uAE30",
  "premise",
  "assumption",
  "condition",
  "factor",
  "risk",
  "issue",
  "point",
  "situation",
  "state",
  "aspect",
  "thing",
  "fact"
]);
var STANCE_CLAIM = new RegExp(
  "(\uB9C8\uC74C\uC5D0\\s*\uAC78\uB9AC|\uAC78\uB9AC\uB294|\uAC78\uB824\\s*\uD558|\uBB34\uAC81|\uBD80\uB2F4|\uBD88\uC548|\uC2E0\uACBD\\s*(\uC4F0|\uC368)|\uC911\uC694\uD558|\uC911\uC2DC|\uC6B0\uC120\uC21C\uC704|\uAE30\uC900\uC774\uB2E4|\uAE30\uC900\uC774\\s*(\uB41C|\uB418)|\uB192\uAC8C\\s*\uBCF4|\uD06C\uAC8C\\s*\uBCF4|\uB0AE\uAC8C\\s*\uBCF4|\uC911\uC694\uD558\uAC8C\\s*\uBCF4|\uBCF4\uACE0\\s*\uC788|\uC0DD\uAC01\uD558\uACE0\\s*\uC788|\uBBFF\uACE0\\s*\uC788|\uAE30\uB300\uD558\uACE0\\s*\uC788|\uC5EC\uAE30\uACE0\\s*\uC788|\uC5EC\uAE34\uB2E4)|\\b(matters? to|weighs? on|cares? (most )?about|believes?|expects?|values?|prioriti[sz]es?)\\b",
  "i"
);
function attributesStanceToUser(text) {
  return STANCE_CLAIM.test(comparable(text));
}
function stemToken(token) {
  return /[가-힣]/.test(token) ? token.slice(0, 2) : token.slice(0, 4);
}
function contentStems(text) {
  const stems = comparable(text).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0 && !STOP_TOKENS.has(token)).map(stemToken);
  return [...new Set(stems)];
}
var CLAIM_NOVELTY_FLOOR = 0.34;
var CLAIM_NOVEL_TOKENS_FLOOR = 2;
function claimBand(text, anchorQuote) {
  const stems = contentStems(text);
  const anchor = new Set(contentStems(anchorQuote));
  if (stems.length === 0) return { novelty: 0, anchor_overlap: 0, novel_count: 0 };
  const novel = stems.filter((s) => !anchor.has(s));
  return {
    novelty: novel.length / stems.length,
    anchor_overlap: stems.length - novel.length,
    novel_count: novel.length
  };
}
var HEDGE = /것\s*같|듯|아마|싶은|싶어|지\s*않을까|할지도|모르겠|같기도|생각도\s*들|\b(maybe|might|probably|possibly|seems?|i think|not sure|could be)\b/i;
function hardensAHedge(text, anchorQuote) {
  return HEDGE.test(comparable(anchorQuote)) && !HEDGE.test(comparable(text));
}
function statesAClaim(text, anchorQuote) {
  const band = claimBand(text, anchorQuote);
  const lexical = band.novelty >= CLAIM_NOVELTY_FLOOR && band.novel_count >= CLAIM_NOVEL_TOKENS_FLOOR;
  return lexical || hardensAHedge(text, anchorQuote);
}

// src/lib/judgment-state-contract.ts
function checkableTexts(records) {
  return records.filter((r) => policyFor(r.kind).competes).map((r) => r.text);
}
function stripModelOnly(item) {
  if (!item) return item;
  if ("decisive" in item) {
    const { decisive: _ignored, ...rest } = item;
    void _ignored;
    return rest;
  }
  return item;
}
function clampSynthesisToLivingState(result, living) {
  const records = (living?.premise_records || []).filter(Boolean);
  const assumptions = records.length > 0 ? records.filter((r) => policyFor(r.kind).competes).map((r) => cleanText(r.text)).filter((text) => text.length > 0) : (living?.hidden_assumptions || []).filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => cleanText(item));
  const checkableCount = records.filter((r) => policyFor(r.kind).verifiable && cleanText(r.if_false_changes).length > 0).length;
  const modelSteps = (result.next_steps || []).filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => cleanText(item));
  const nextSteps = modelSteps.slice(0, checkableCount);
  const assumptionHeading = /(전제|가정|아직.*(?:확인|모르)|확인되지|assumptions?|unverified|unknown)/i;
  const realityCheckHeading = /(현실.*확인|확인할\s*것|reality checks?|to verify)/i;
  const actionHeading = /(다음\s*(?:단계|행동)|행동\s*계획|실행\s*계획|next steps?|action plans?|execution plans?)/i;
  return {
    ...result,
    sections: (result.sections || []).filter((section) => {
      const heading = cleanText(section?.heading);
      if (assumptions.length === 0 && assumptionHeading.test(heading)) return false;
      if (nextSteps.length === 0 && (realityCheckHeading.test(heading) || actionHeading.test(heading))) return false;
      return true;
    }),
    key_assumptions: assumptions,
    next_steps: nextSteps
  };
}
var MAX_CLAIMS = 2;
var MAX_RECORDS = 4;
function claimCount(records) {
  return records.filter((r) => policyFor(r.kind).competes).length;
}
function gateByKind(declared, text, anchorQuote, stanceFromContext = false, observable = "") {
  const band = claimBand(text, anchorQuote);
  let kind = attributesStanceToUser(text) ? "standard" : asKind(declared);
  if (KIND_POLICY[kind].needsStance) {
    return stanceFromContext || hasExplicitSupportSignal(anchorQuote) ? { ok: true, kind, reason: "grounded", band } : { ok: false, kind, reason: "standard_without_user_stance", band };
  }
  let reason = "grounded";
  if (KIND_POLICY[kind].needsObservable && !observable) {
    kind = "premise";
    reason = "prediction_without_observable_read_as_premise";
  }
  if (KIND_POLICY[kind].needsClaim && !statesAClaim(text, anchorQuote)) {
    return { ok: true, kind: "fact", reason: "restates_anchor_recorded_as_fact", band };
  }
  return { ok: true, kind, reason, band };
}
function asRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function findExisting(premises, candidate) {
  const target = comparable(candidate);
  return premises.findIndex((premise) => comparable(premise) === target);
}
function missingRequiredField(declared, text, anchorQuote, supportKind, ifFalseChanges) {
  if (!text || !anchorQuote) return true;
  const policy = policyFor(declared);
  if (policy.needsSupportKind && !SUPPORT_KINDS.has(supportKind)) return true;
  if (policy.needsCounterfactual && !ifFalseChanges) return true;
  return false;
}
function coercePremiseCandidates(raw, userCorpus) {
  const records = [];
  const audit = [];
  const candidates = Array.isArray(raw) ? raw : [];
  for (const value of candidates) {
    const item = stripModelOnly(asRecord(value));
    const text = cleanText(item?.text);
    const anchorQuote = cleanText(item?.anchor_quote);
    const supportKind = cleanText(item?.support_kind);
    const ifFalseChanges = cleanText(item?.if_false_changes);
    if (missingRequiredField(item?.kind, text, anchorQuote, supportKind, ifFalseChanges)) {
      audit.push({
        accepted: false,
        action: "initial",
        text: text || void 0,
        declared_kind: asKind(item?.kind),
        reason: "missing_required_field"
      });
      continue;
    }
    if (!isTraceableQuote(anchorQuote, userCorpus)) {
      audit.push({
        accepted: false,
        action: "initial",
        text,
        reason: "anchor_not_in_user_words"
      });
      continue;
    }
    const gate = gateByKind(item?.kind, text, anchorQuote, false, cleanText(item?.observable));
    const entry = {
      action: "initial",
      text,
      declared_kind: asKind(item?.kind),
      recorded_kind: gate.kind,
      band: gate.band
    };
    if (!gate.ok) {
      audit.push({ ...entry, accepted: false, reason: gate.reason });
      continue;
    }
    if (findExisting(records.map((r) => r.text), text) >= 0) {
      audit.push({ ...entry, accepted: false, reason: "duplicate" });
      continue;
    }
    if (policyFor(gate.kind).competes && claimCount(records) >= MAX_CLAIMS) {
      audit.push({ ...entry, accepted: false, reason: "premise_limit" });
      continue;
    }
    if (records.length >= MAX_RECORDS) {
      audit.push({ ...entry, accepted: false, reason: "record_limit" });
      continue;
    }
    records.push({
      text,
      anchor_quote: anchorQuote,
      if_false_changes: ifFalseChanges,
      support_kind: SUPPORT_KINDS.has(supportKind) ? supportKind : "explicit_reason",
      kind: gate.kind,
      ...cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}
    });
    audit.push({ ...entry, accepted: true, reason: gate.reason });
  }
  return { premises: checkableTexts(records), records, audit };
}
function verdictsWorthTelling(audit) {
  return (audit || []).filter((entry) => entry.text && entry.declared_kind && (!entry.accepted || entry.declared_kind !== entry.recorded_kind)).map((entry) => ({
    text: entry.text,
    declared: entry.declared_kind,
    ...entry.accepted ? { recorded: entry.recorded_kind } : {},
    reason: entry.reason
  }));
}
function verdictInstruction(reason) {
  switch (reason) {
    case "restates_anchor_recorded_as_fact":
      return "it repeats its own anchor, so it was filed as a fact. If it really is load-bearing, say what that fact makes possible or impossible in THIS decision. If you cannot, leaving it as a fact is the right outcome.";
    case "standard_without_user_stance":
      return "it states what weighs on this person, but the quote does not carry their own weighing words \u2014 so it was refused rather than put in their mouth. Ask them instead of asserting it.";
    case "prediction_without_observable_read_as_premise":
      return "no observable, so it cannot promise a settle date and was filed as an assumption. Name what would be SEEN and it can be a prediction.";
    case "anchor_not_in_user_words":
      return "the quote does not appear in anything they wrote. Quote exactly.";
    case "premise_limit":
      return "two assumptions are already open. Revise one instead of stacking a third.";
    case "record_limit":
      return "the record is full. Revise or remove before adding.";
    case "duplicate":
      return "already recorded.";
    case "missing_required_field":
      return "an add needs text, anchor_quote, support_kind and if_false_changes.";
    case "latest_answer_evidence_missing":
      return "a change to an existing item needs a quote from the answer they just gave.";
    default:
      return reason;
  }
}
function applyPremiseDeltas(currentRecords, raw, fullUserCorpus, latestAnswer) {
  const records = (currentRecords || []).map((entry) => {
    if (typeof entry === "string") {
      return entry.trim() ? { text: cleanText(entry), anchor_quote: "", if_false_changes: "", support_kind: "explicit_reason", kind: "premise" } : null;
    }
    return entry && typeof entry.text === "string" && entry.text.trim() ? { ...entry, text: cleanText(entry.text) } : null;
  }).filter((r) => r !== null).slice(0, MAX_RECORDS);
  const premises = records.map((r) => r.text);
  const audit = [];
  const deltas = Array.isArray(raw) ? raw : [];
  for (const value of deltas) {
    const item = stripModelOnly(asRecord(value));
    const action = cleanText(item?.action);
    const previousText = cleanText(item?.previous_text);
    const text = cleanText(item?.text);
    const anchorQuote = cleanText(item?.anchor_quote);
    const reason = cleanText(item?.reason_from_latest_answer);
    const supportKind = cleanText(item?.support_kind);
    const ifFalseChanges = cleanText(item?.if_false_changes);
    if (!["keep", "add", "remove", "revise"].includes(action)) {
      audit.push({ accepted: false, action: "keep", reason: "invalid_action" });
      continue;
    }
    if (action === "keep") {
      const target = previousText || text;
      const existingIndex2 = findExisting(premises, target);
      audit.push({
        accepted: existingIndex2 >= 0,
        action,
        previous_text: target || void 0,
        reason: existingIndex2 >= 0 ? "preserved" : "premise_not_found"
      });
      continue;
    }
    if (action === "add") {
      if (missingRequiredField(item?.kind, text, anchorQuote, supportKind, ifFalseChanges)) {
        audit.push({
          accepted: false,
          action,
          text: text || void 0,
          declared_kind: asKind(item?.kind),
          reason: "missing_required_field"
        });
        continue;
      }
      if (!isTraceableQuote(anchorQuote, fullUserCorpus)) {
        audit.push({ accepted: false, action, text, reason: "anchor_not_in_user_words" });
        continue;
      }
      const gate = gateByKind(
        item?.kind,
        text,
        anchorQuote,
        isTraceableQuote(anchorQuote, latestAnswer),
        cleanText(item?.observable)
      );
      const entry = {
        action,
        text,
        declared_kind: asKind(item?.kind),
        recorded_kind: gate.kind,
        band: gate.band
      };
      if (!gate.ok) {
        audit.push({ ...entry, accepted: false, reason: gate.reason });
        continue;
      }
      if (findExisting(premises, text) >= 0) {
        audit.push({ ...entry, accepted: false, reason: "duplicate" });
        continue;
      }
      if (policyFor(gate.kind).competes && claimCount(records) >= MAX_CLAIMS) {
        audit.push({ ...entry, accepted: false, reason: "premise_limit" });
        continue;
      }
      if (records.length >= MAX_RECORDS) {
        audit.push({ ...entry, accepted: false, reason: "record_limit" });
        continue;
      }
      records.push({
        text,
        anchor_quote: anchorQuote,
        if_false_changes: ifFalseChanges,
        support_kind: SUPPORT_KINDS.has(supportKind) ? supportKind : "explicit_reason",
        kind: gate.kind,
        ...cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}
      });
      premises.push(text);
      audit.push({ ...entry, accepted: true, reason: gate.reason });
      continue;
    }
    const existingIndex = findExisting(premises, previousText);
    if (existingIndex < 0) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText || void 0,
        text: text || void 0,
        reason: "premise_not_found"
      });
      continue;
    }
    if (!reason || !anchorQuote || !isTraceableQuote(anchorQuote, latestAnswer)) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText,
        text: text || void 0,
        reason: "latest_answer_evidence_missing"
      });
      continue;
    }
    if (action === "remove") {
      records.splice(existingIndex, 1);
      premises.splice(existingIndex, 1);
      audit.push({ accepted: true, action, previous_text: previousText, reason: "latest_answer_grounded" });
      continue;
    }
    if (missingRequiredField(item?.kind, text, anchorQuote, supportKind, ifFalseChanges)) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText,
        text: text || void 0,
        declared_kind: asKind(item?.kind),
        reason: "missing_required_field"
      });
      continue;
    }
    const duplicateIndex = findExisting(premises, text);
    if (duplicateIndex >= 0 && duplicateIndex !== existingIndex) {
      audit.push({ accepted: false, action, previous_text: previousText, text, reason: "duplicate" });
      continue;
    }
    const revised = gateByKind(item?.kind, text, anchorQuote, true, cleanText(item?.observable));
    records[existingIndex] = {
      text,
      anchor_quote: anchorQuote,
      if_false_changes: ifFalseChanges,
      support_kind: SUPPORT_KINDS.has(supportKind) ? supportKind : "explicit_reason",
      kind: revised.kind,
      ...cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}
    };
    premises[existingIndex] = text;
    audit.push({
      accepted: true,
      action,
      previous_text: previousText,
      text,
      declared_kind: asKind(item?.kind),
      recorded_kind: revised.kind,
      band: revised.band,
      reason: "latest_answer_grounded"
    });
  }
  const kept = records.slice(0, MAX_RECORDS);
  return { premises: checkableTexts(kept), records: kept, audit };
}

// src/lib/judgment-harness-v2.ts
var ROUTES = `Choose exactly one request_type:
- open: the user is genuinely deciding and another answer could change the map.
- flat: either choice is low-cost and roughly equivalent.
- vent: emotion is the request; no decision work was requested.
- validation: the decision is already made or is only being logged.
- info: a factual/how-to answer is requested.
- resistance: the same decision has stayed open without new information.
- self_profiling: the user asks for a verdict about who they are.
- crisis: imminent harm, abuse/coercion, or a scam-shaped emergency.`;
var EPISTEMIC_CONTRACT = `ARGUS JUDGMENT CONTRACT
1. Do not choose for the user and do not imply which side is wiser.
2. Use only the user's words as facts. Training-memory facts are not evidence.
3. An empty field is better than a plausible invention. There is NO minimum
   number of assumptions, checks, options, or plan items.
4. A hidden assumption is allowed only when it is both:
   (a) explicitly presented by the user as a reason, condition, expectation, or
       dependency for their decision, and
   (b) capable of changing the decision if false.
   A mentioned fact, option attribute, date, number, or uncertainty is not a
   premise merely because it could matter. Do not attribute a belief to the user
   ("you seem to think", "you appear to assume"). Write the proposition itself.
   Do not introduce a new legal, market, organizational, psychological, or
   contractual dimension merely because it is commonly relevant.
5. The next question earns its place only when different answers would change
   what Argus reflects or what the user needs to verify next. Ask one question.
6. Do not manufacture multiple-choice branches. Use a short answer by default.
   Offer options only when those branches already appear in the user's words.
7. Conversation is a mirror, not an action planner. skeleton MUST remain [].
   Reality checks move into the living-state patch only after they have their
   own provenance contract. Deep specialist execution is a separate explicit path.
8. Keep the user's wording recognizable. Sharpen only the ambiguity that blocks
   the next useful distinction; do not replace their question with a grander one.
9. Distinguish a user fact from an AI-surfaced premise in the prose. Every
   premise proposal must carry a short exact quote from the user's words and
   say what would change if the premise were false. Never present an inference
   as something the user said.
10. Stop when no grounded, load-bearing gap remains. More analysis is not success.
11. ASK, DO NOT ASSERT. When you believe something the user merely mentioned is
    actually load-bearing, that belief is yours, not theirs \u2014 it may NOT be
    proposed as a premise. Make it the one question instead ("\uB7F0\uC6E8\uC774 18\uAC1C\uC6D4\uC774\uB77C\uB294
    \uAC8C \uC774 \uACB0\uC815\uC5D0\uC11C \uC5BC\uB9C8\uB098 \uAC78\uB9AC\uB294 \uAC70\uC608\uC694?"). Their answer becomes the anchor, and
    the premise can then be added in their own words. This is how the premise
    list fills honestly: user says it \u2192 it is recorded; you infer it \u2192 you ask.

${ARGUS_PRODUCT_FACTS}`;
var SAFETY_AND_NEUTRALITY = `SAFETY AND NEUTRALITY
- The deterministic safety gate normally handles crisis input first. If crisis
  still reaches this prompt, stop the judgment flow and include one concrete,
  reachable resource in insight (Korean examples: \uC790\uC0B4\uC608\uBC29\uC0C1\uB2F4 109, \uC5EC\uC131\uAE34\uAE09\uC804\uD654
  1366). Do not promise that a solution or safe path is guaranteed.
- For validation, first receive the decision as already made. Never ask whether
  they want validation when they just said so. A check must stand alone, be
  anchored to a constraint the user named, and must not end in conditional
  reassurance such as "if that is absent, there is no problem."
- A hand-up from the light path ("\uB354 \uAE4A\uC774 \uBCF4\uAE30" chosen by the user) is open but
  minimal: one neutral crux, no recognition speech, no plan.
- Routine and reversible means less ceremony: no assumptions or checks unless
  the user's own words make one load-bearing.
- No outside-world claim, including plausible behavioral or social statistics,
  is a fact without supplied evidence. Omit it or identify it as unverified.
- Questions never exaggerate their importance with claims such as "completely
  changes" or "\uD06C\uAC8C \uC88C\uC6B0\uD574\uC694."
- Never repeat a question already asked, including one the user skipped by
  replying with different information.
- MENTIONING IS NOT MATTERING. Bringing something up is not the same as saying
  it weighs on them. Report the act; do not convert it into their stance.
  \u2717 "\uB7F0\uC6E8\uC774\uB97C \uAEBC\uB0B4\uC168\uC5B4\uC694 \u2014 \uC7AC\uC815 \uC548\uC815\uC131\uC774 \uAC78\uB9AC\uB294 \uC9C0\uC810\uC774\uB77C\uB294 \uAC78 \uC54C\uB824\uC8FC\uC2E0 \uAC70\uC608\uC694"
  \u2717 "\uBB3C\uB958 \uB3C4\uBA54\uC778\uC740 \uC774\uBBF8 \uC544\uC2DC\uB2C8 \uBC18\uC740 \uB41C \uAC70\uC608\uC694" (\uC548\uC2EC\uB3C4 \uB300\uC2E0 \uB0B4\uB9AC\uB294 \uD310\uB2E8\uC774\uB2E4)
  \u2713 "\uB7F0\uC6E8\uC774\uAC00 18\uAC1C\uC6D4\uC774\uB77C\uACE0 \uD558\uC168\uC5B4\uC694." Then ASK whether it is decisive. This is
  the single most-measured failure of this harness \u2014 the inference feels
  generous, and it still puts words in their mouth.
- HOW THEY SAID IT IS NOT DATA EITHER. Their grammar, particle, ending, tone or
  word choice is never evidence about their inner state, and never something to
  point at. This is the worst line this harness has produced: someone wrote six
  words, "\uD1F4\uC0AC\uD558\uACE0 \uC5EC\uD589\uC774\uB098 \uAC08\uAE4C", and got back
  \u2717 "'\uC774\uB098'\uAC00 \uBD99\uC740 \uAC70, \uADF8\uB0E5 \uD0C8\uCD9C\uD558\uACE0 \uC2F6\uB2E4\uB294 \uB9D0\uCC98\uB7FC \uB4E4\uB824\uC694."
  It analysed their particle and handed them a feeling \u2014 \uD0C8\uCD9C \u2014 they had never
  named. An independent audit scored three separate identity-level failures on
  that one sentence. A person's choice of ending is not a confession.
  \u2713 "\uD1F4\uC0AC\uB791 \uC5EC\uD589\uC774 \uAC19\uC774 \uB098\uC654\uB124\uC694. \uB458 \uC911 \uBB50\uAC00 \uBA3C\uC800 \uB5A0\uC624\uB978 \uAC70\uC608\uC694?"
  Never name an emotion, motive, or state the user did not name. Reflect the
  words; ask about the rest. Code strips any sentence that cites their wording
  as its evidence, so writing one only costs them the sentence.
- SILENCE IS NOT DATA. What the user did NOT say carries no meaning you may
  state. When they answer something other than what you asked, follow the new
  information and say what it adds \u2014 never explain why they redirected, and
  never rank their concerns on their behalf. \u2717 "\uB7F0\uC6E8\uC774 \uC9C8\uBB38\uC5D0 \uB2F5\uD558\uC9C0 \uC54A\uC73C\uC2E0 \uAC78
  \uBCF4\uBA74 \uC2B9\uC9C4 \uCABD\uC774 \uB354 \uAC78\uB9AC\uB294 \uAC70\uC8E0" / \u2717 "A\uBCF4\uB2E4 B\uAC00 \uB354 \uC55E\uC5D0 \uC788\uB294 \uAC70\uC8E0" \u2713 "\uC2B9\uC9C4\uC774
  \uAD6C\uB450\uB85C\uB9CC \uB098\uC628 \uC598\uAE30\uB77C\uB294 \uAC78 \uC54C\uB824\uC8FC\uC168\uC5B4\uC694." Ranking what weighs more on a person
  is theirs to say, and they did not say it.
- NEVER ADJUDICATE BETWEEN THE USER AND ANOTHER PERSON. When the decision is a
  disagreement \u2014 a cofounder, a partner, a manager \u2014 you may hold both readings,
  and you may not say whose reading the evidence supports. The user is one of
  the parties, so siding with them is not agreement, it is taking the decision
  away from a conversation they still have to have.
  \u2717 (measured) "\uACF5\uB3D9\uCC3D\uC5C5\uC790 \uBD84\uC740 '\uC9C0\uAE08 \uB2F9\uC7A5 \uC601\uC5C5'\uC774\uB77C\uACE0 \uD558\uC9C0\uB9CC, \uCCAB \uB2EC\uC5D0 70%\uAC00
    \uB5A0\uB098\uB294 \uC0C1\uD0DC\uC5D0\uC11C \uC601\uC5C5\uC744 \uB298\uB9AC\uBA74 \uC18C\uC9C4\uB9CC \uBE68\uB77C\uC9C0\uAC70\uB4E0\uC694. \uBC18\uBA74 \uC81C\uD488\uC744 \uBA3C\uC800
    \uB2E4\uB4EC\uC790\uB294 \uCABD\uC5D0\uB294 \uC774 \uC22B\uC790\uAC00 \uC2E4\uC81C \uADFC\uAC70\uAC00 \uB3FC\uC694."
    Two violations in one breath: an outside-world causal claim the user never
    supplied, and a ruling on which of two people the number belongs to.
  \u2713 "\uB9AC\uD150\uC158 30%\uB77C\uB294 \uC22B\uC790\uAC00 \uB098\uC654\uC5B4\uC694. \uB450 \uBD84\uC774 \uC774 \uC22B\uC790\uB97C \uAC19\uC740 \uB73B\uC73C\uB85C \uBCF4\uACE0 \uACC4\uC2E0\uC9C0\uB294
    \uC544\uC9C1 \uC548 \uB098\uC654\uACE0\uC694."
  Bring the number back; ask what THEY both make of it.
- AND WHEN THEY DO SAY IT, IT STANDS. If the user weighs their own concerns,
  leave that scale alone \u2014 do not lift the side they just put down. Measured:
  someone wrote "\uD53C\uACE4\uD55C \uCABD\uC774 \uB354 \uCEE4" and got back "\uADF8\uB798\uB3C4 \uB0A8\uD3B8\uC774 \uB2A6\uAC8C\uAE4C\uC9C0 \uC788\uACE0
  \uC2F6\uC740 \uB208\uCE58\uB77C\uB294 \uAC8C \uAC78\uB9AC\uC2DC\uB294 \uAC70\uACE0\uC694", which quietly re-opened what they had
  closed. Balancing the two sides is not neutrality. Not touching the weights
  they assigned is.
- Options, when truly needed, describe the user's possible states. They never
  carry a conclusion or preferred direction.
- Do not introduce a loaded metaphor for either side. Mirror one only when the
  user used it first.
- When framing confidence is below 70, ask only for the missing frame. Do not
  surface assumptions or reality checks yet.`;
function voice(locale) {
  return locale === "ko" ? `Answer in natural Korean \uD574\uC694\uCCB4. Avoid translated, corporate, or report-like phrasing.
${KOREAN_VOICE_RULES}` : "Answer in natural, direct English. Avoid corporate or therapeutic filler.";
}
function buildInitialJudgmentPrompt(problemText, locale = "en") {
  return {
    system: `You are Argus: a judgment harness that helps a person see what their
decision currently rests on. You are not a committee, coach, or answer engine.

${voice(locale)}

${EPISTEMIC_CONTRACT}

${SAFETY_AND_NEUTRALITY}

${ROUTES}

ROUTE BEHAVIOR
- Only open may ask a decision-shaping question.
- flat: give one light distinction or say either is reasonable; no ceremony.
- vent: receive what they said in one warm line; do not analyze.
- validation: receive the decision as made. Add at most one check only if it is
  directly named by the user; otherwise stop.
- info: answer directly and mark uncertainty honestly. If the honest answer is a
  structure or an order of work, give it as ONE workable approach and say what
  would change it \u2014 never as the prescribed shape. "\uC5B4\uB514\uC11C\uBD80\uD130 \uD560\uC9C0 \uBAA8\uB974\uACA0\uB2E4"
  is not a request for a template; it may first need one line asking which part
  is actually stuck.
- resistance: name only the observable repetition and offer at most one small
  reality test; do not diagnose avoidance.
- self_profiling: do not cold-read the user.
- crisis: do not run the decision harness. Use the dedicated safety response.

OUTPUT DISCIPLINE
- insight: one or two concise sentences. Mirror the current decision state and
  name the unresolved distinction only if it is grounded.
- frame_line: what the decision turns on, in their words, SHORTER than they said
  it. A statement, not a question. It is not an inventory of their facts, and in
  Korean it must not be closed with "~\uD558\uB294 \uC0C1\uD669\uC774\uC5D0\uC694 / ~\uC0C1\uD0DC\uC608\uC694" \u2014 that tail
  turns a reflection into an intake form. Do not manufacture a binary "X or Y"
  question and do not call it the real or core question.
  \u2717 "\uC5F0\uBD09 40% \uC624\uD37C\uC640 \uB9AC\uB4DC \uC2B9\uC9C4 \uC0AC\uC774\uC5D0\uC11C \uC77C\uC8FC\uC77C \uC548\uC5D0 \uB2F5\uC744 \uC918\uC57C \uD558\uB294 \uC0C1\uD669\uC774\uC5D0\uC694."
  \u2713 "\uC2B9\uC9C4\uC740 \uC544\uC9C1 \uB9D0\uBFD0\uC778\uB370, \uC624\uD37C\uB294 \uC77C\uC8FC\uC77C \uC548\uC5D0 \uB2F5\uC744 \uB2EC\uB77C\uACE0 \uD558\uB124\uC694." 
- real_question: legacy compatibility; copy frame_line exactly.
- Do not emit any field not listed below. Every field here is read by the
  product; anything else costs the user latency and buys nothing.
- premise_candidates: 0-2 conditional, load-bearing premise proposals. Each
  needs text, an exact anchor_quote copied from the user's explicit
  reason/condition/expectation, support_kind, and if_false_changes.
  Each candidate also carries "kind", chosen by what can be DONE with it later:
    "fact"          they told us; reality already fixed it   (quote, never check)
    "premise"       has to hold for the decision to work     (verify)
    "prediction"    truth-apt about the future               (settle on a date)
    "standard"      THEIR OWN weighting ("\uB3C8\uBCF4\uB2E4 \uC131\uC7A5\uC774 \uC911\uC694\uD574\uC694")
                    \u2192 record it, never test it. A person's values are not
                      right or wrong, and asking them later "\uADF8\uAC70 \uB9DE\uC558\uC5B4\uC694?"
                      would be grading who they are. This is usually what
                      actually decides the call, so capture it \u2014 as a standard.
    "open_question" nobody has answered it yet               (ask)
  And "observable": what you would SEE that settles it, in their world
  ("\uC2B9\uC9C4 \uACF5\uBB38", "\uB2E4\uC74C \uB77C\uC6B4\uB4DC \uBC1C\uD45C"). Omit it when nothing observable would.
  if_false_changes says what CHANGES if it is false; observable says how anyone
  would ever know. A premise with neither is a feeling, not a premise.
  WHERE TO LOOK. Measured: across 11 real sessions the model proposed TWO
  premises total, while the users' own sentences carried them plainly. Every
  rule above says what a premise is NOT; here is what one IS, on real material.

  User wrote: "\uB450 \uBC88 \uBA74\uB2F4\uD588\uACE0 \uAC1C\uC120 \uACC4\uD68D\uB3C4 \uAC19\uC774 \uC7A1\uC558\uB294\uB370 \uBCC0\uD654\uAC00 \uC5C6\uC5B4\uC694.
               \uC791\uB144\uC5D0 \uC800\uB97C \uBBFF\uACE0 \uC774\uC9C1\uD574\uC11C \uC628 \uC0AC\uB78C\uC774\uB77C \uB9C8\uC74C\uC774 \uB9CE\uC774 \uBB34\uAC81\uC2B5\uB2C8\uB2E4."
  \u2192 {"text": "\uBA74\uB2F4\uACFC \uACC4\uD68D\uC73C\uB85C \uB2EC\uB77C\uC9C8 \uC0AC\uB78C\uC774\uC5C8\uB2E4\uBA74 6\uAC1C\uC6D4 \uC548\uC5D0 \uC2E0\uD638\uAC00 \uBCF4\uC600\uB2E4",
     "anchor_quote": "\uB450 \uBC88 \uBA74\uB2F4\uD588\uACE0 \uAC1C\uC120 \uACC4\uD68D\uB3C4 \uAC19\uC774 \uC7A1\uC558\uB294\uB370 \uBCC0\uD654\uAC00 \uC5C6\uC5B4\uC694",
     "support_kind": "explicit_reason",
     "if_false_changes": "\uC544\uC9C1 \uBC29\uBC95\uC744 \uC548 \uC368\uBCF8 \uAC83\uC774\uBBC0\uB85C \uB0B4\uBCF4\uB0B4\uB294 \uD310\uB2E8\uC774 \uC774\uB974\uB2E4",
     "kind": "premise", "observable": "\uB2E4\uC74C \uC8FC \uAE30\uD55C\uC758 \uACB0\uACFC"}
  \u2192 {"text": "\uB0B4 \uAD8C\uC720\uB85C \uC628 \uC0AC\uB78C\uC774\uB77C\uB294 \uC0AC\uC2E4\uC774 \uC774 \uACB0\uC815\uC744 \uBB34\uAC81\uAC8C \uB9CC\uB4E0\uB2E4",
     "anchor_quote": "\uC800\uB97C \uBBFF\uACE0 \uC774\uC9C1\uD574\uC11C \uC628 \uC0AC\uB78C\uC774\uB77C \uB9C8\uC74C\uC774 \uB9CE\uC774 \uBB34\uAC81\uC2B5\uB2C8\uB2E4",
     "support_kind": "explicit_reason",
     "if_false_changes": "\uC131\uACFC\uB9CC \uB193\uACE0 \uBCF4\uB294 \uACB0\uC815\uC774 \uB41C\uB2E4",
     "kind": "standard"}
  The second is a standard, not a premise: it is what MATTERS to them, and it is
  usually the thing actually deciding the call. Capture it \u2014 as a standard.

  Restraint means not INVENTING one. It does not mean refusing to see one that
  is written in front of you. Both failures are failures.

  The "text" field states what must HOLD for their decision to work \u2014 a claim that
  could turn out false \u2014 NOT a restatement of the fact you anchored to, and not
  a label stuck on it. \u2717 "\uB7F0\uC6E8\uC774\uAC00 18\uAC1C\uC6D4\uC774\uB2E4" (\uC0AC\uC2E4\uC774\uC9C0 \uC804\uC81C\uAC00 \uC544\uB2D8)
  \u2717 "\uB7F0\uC6E8\uC774 18\uAC1C\uC6D4\uC774 \uB9AC\uC2A4\uD06C \uBCC0\uC218\uB2E4" (\uAC19\uC740 \uC0AC\uC2E4\uC5D0 \uC774\uB984\uB9CC \uBD99\uC778 \uAC83)
  \u2713 "18\uAC1C\uC6D4 \uC548\uC5D0 \uB2E4\uC74C \uB77C\uC6B4\uB4DC\uB098 \uD751\uC790 \uC804\uD658\uC774 \uC628\uB2E4". If the only sentence you can
  write is the fact itself, write it with "kind":"fact" \u2014 that is honest and
  costs nothing. Do not dress it as a premise.

  ONE EXCEPTION, and it is the most valuable move available: when THEY hedged
  and you can name what would settle it, take the hedge off. "\uC9D1\uC8FC\uC778\uC774 \uC804\uC138\uAE08\uC744
  \uC62C\uB824\uB2EC\uB77C\uACE0 \uD560 \uAC83 \uAC19\uAE30\uB3C4 \uD558\uACE0\uC694" \u2192 {"text":"\uC9D1\uC8FC\uC778\uC774 \uC804\uC138\uAE08\uC744 \uC62C\uB824\uB2EC\uB77C\uACE0 \uD560
  \uAC83\uC774\uB2E4", "kind":"prediction", "observable":"\uB9CC\uAE30 \uC804 \uAC31\uC2E0 \uC758\uC0AC\uB97C \uBB3C\uC5C8\uC744 \uB54C
  \uB098\uC624\uB294 \uB2F5"}. Almost no new words, and a worry that could never be right or
  wrong becomes something reality answers. A prediction ALWAYS needs its
  observable; without one it is just an assumption with a date on it.
  Candidate object shape: {"text":"...", "anchor_quote":"...",
  "support_kind":"explicit_reason|explicit_condition|explicit_expectation",
  "if_false_changes":"...", "kind":"fact|premise|prediction|standard|open_question",
  "observable":"..."}. [] is often right.
  The runtime will reject a proposal without that lineage.
- skeleton: always [] on this first turn.
- next_question: one short question or null. Avoid subtext unless it explains the
  exact comparison the answer will inform. Do not claim it changes everything.
- framing_confidence measures confidence that you understood the question, not
  confidence about which choice is right.

Return JSON only:
{
  "request_type": "open|flat|vent|validation|info|resistance|self_profiling|crisis",
  "stakes": "routine|important|critical",
  "reversibility": "reversible|partial|irreversible",
  "framing_confidence": 0,
  "frame_line": "neutral current situation line",
  "real_question": "copy frame_line exactly for legacy compatibility",
  "insight": "one or two concise sentences",
  "premise_candidates": [],
  "skeleton": [],
  "next_question": {"text": "one grounded question", "type": "short"} or null
}`,
    user: `<user-data>${sanitizeForPrompt(problemText)}</user-data>`
  };
}
function buildDeepeningJudgmentPrompt(problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, locale = "en") {
  const history = questionsAndAnswers.map(
    (qa, index) => `Q${index + 1}: ${sanitizeForPrompt(qa.question.text)}
A${index + 1}: ${sanitizeForPrompt(String(qa.answer.value ?? ""))}`
  ).join("\n\n");
  const finalRound = round >= maxRounds - 1;
  const verdicts = currentSnapshot.premise_verdicts || [];
  const verdictBlock = verdicts.length > 0 ? `
WHAT HAPPENED TO YOUR LAST PROPOSALS (the runtime reporting an outcome,
not a critic \u2014 this is already done, so just make the next move):
${verdicts.map((v) => `- "${sanitizeForPrompt(v.text)}" \u2014 you called it ${v.declared}; ${v.recorded ? `recorded as ${v.recorded}. ` : "not recorded. "}${verdictInstruction(v.reason)}`).join("\n")}
` : "";
  return {
    system: `You are Argus updating a living judgment state after one new answer.

${voice(locale)}

${EPISTEMIC_CONTRACT}

${SAFETY_AND_NEUTRALITY}

UPDATE CONTRACT
1. The latest answer is evidence about the user's situation. It is not permission
   to add adjacent expert knowledge.
2. Preserve every field the answer did not change. Visible stability is valid.
   But frame_line tracks what the decision IS, so a hard constraint the user just
   supplied belongs in it ("\u2026\uC2B9\uC9C4\uC740 \uC544\uC9C1 \uAD6C\uB450\uB85C\uB9CC \uB098\uC628 \uC0C1\uD0DC\uC5D0\uC11C\u2026"). A frame that
   never moves while the user keeps adding constraints reads as nothing landing.
   Fold it in with their wording; do not restyle it for the sake of movement.
3. Do not rewrite the full premise list. Report only premise_changes caused by
   the latest answer. An omitted premise remains unchanged.

   AN ANSWER IS RAW MATERIAL, NOT THE RECORD. They just told you something that
   bears on the decision \u2014 the best material the session produces \u2014 and the
   work is to say what it MAKES POSSIBLE OR IMPOSSIBLE in the choice they are
   actually facing. Writing the number down is not that work.

   THE EXAMPLE BELOW IS ABOUT FORM, NEVER ABOUT CONTENT. Do not carry its
   domain, its reasoning, or its direction into the session in front of you.
   (Measured: an earlier version of this example was drawn from a real scenario,
   and the model reproduced its analysis as its own conclusion in that very
   scenario \u2014 three independent audits scored it an identity-level failure.)

   Someone weighing a 6-month evening course answers "\uC218\uAC15\uB8CC\uB294 \uD68C\uC0AC\uAC00 \uC808\uBC18
   \uB0B4\uC918\uC694."

   \u2717 {"action":"add","text":"\uC218\uAC15\uB8CC\uC758 \uC808\uBC18\uC744 \uD68C\uC0AC\uAC00 \uB0B8\uB2E4","kind":"fact"}
     True, and it changes nothing. It restates the answer.

   \u2713 {"action":"add",
      "text":"\uD68C\uC0AC\uAC00 \uC808\uBC18\uC744 \uB0B4\uC8FC\uB294 \uC870\uAC74\uC774 \uC720\uC9C0\uB3FC\uC57C \uC774 \uBE44\uC6A9\uC744 \uAC10\uB2F9\uD560 \uC218 \uC788\uB2E4",
      "anchor_quote":"\uC218\uAC15\uB8CC\uB294 \uD68C\uC0AC\uAC00 \uC808\uBC18 \uB0B4\uC918\uC694",
      "reason_from_latest_answer":"\uBE44\uC6A9\uC744 \uAC10\uB2F9 \uAC00\uB2A5\uD558\uAC8C \uB9CC\uB4DC\uB294 \uC870\uAC74\uC774 \uB4DC\uB7EC\uB0AC\uB2E4",
      "support_kind":"explicit_condition",
      "if_false_changes":"\uC790\uBE44\uB85C \uC804\uC561\uC774\uBA74 \uC2DC\uC810 \uC790\uCCB4\uB97C \uB2E4\uC2DC \uBD10\uC57C \uD55C\uB2E4",
      "kind":"premise","observable":"\uB2E4\uC74C \uBD84\uAE30 \uAD50\uC721\uBE44 \uC9C0\uC6D0 \uACF5\uC9C0"}
     A later answer about the same condition is a revise, not a third row.

   The test: does this sentence say what the answer makes possible or
   impossible? If you cannot say it honestly, record the plain fact with
   "kind":"fact" and stop. A fact is a correct and cheap outcome. A fact
   wearing the word \uC804\uC81C is not.
   Restraint is not inventing one; it is not refusing to see one.

   ONE CLAIM PER PREMISE. An audit caught this exact sentence, which is two
   claims stapled together with a condition the user never set:
   \u2717 "\uCCAB \uB2EC \uB9AC\uD150\uC158 30%\uAC00 \uC9C0\uAE08 \uC81C\uD488\uC744 \uBA3C\uC800 \uACE0\uCCD0\uC57C \uD55C\uB2E4\uB294 \uC870\uAC74\uC774 \uB41C\uB2E4\uBA74, 10\uAC1C\uC6D4
      \uC548\uC5D0 \uC81C\uD488\uC744 \uC7A1\uACE0 \uB098\uC11C\uC57C \uC601\uC5C5\uC774 \uD1B5\uD55C\uB2E4"
   The antecedent is your framing, so the whole sentence inherits it and none of
   it can be checked cleanly. Write the part that could turn out false, alone:
   \u2713 "10\uAC1C\uC6D4 \uC548\uC5D0 \uB9AC\uD150\uC158\uC744 \uC62C\uB9AC\uC9C0 \uBABB\uD558\uBA74 \uC601\uC5C5\uC744 \uB298\uB824\uB3C4 \uC18C\uC9C4\uB9CC \uBE68\uB77C\uC9C4\uB2E4"
   A conditional is fine when the IF is the user's own ("\uBA74\uB2F4\uACFC \uACC4\uD68D\uC744 \uB450 \uCC28\uB840
   \uAC70\uCCE4\uB294\uB370\uB3C4 \uBCC0\uD654\uAC00 \uC5C6\uC5C8\uB2E4\uBA74, \uC9C0\uAE08 \uBC29\uBC95\uC73C\uB85C\uB294 \uB2EC\uB77C\uC9C0\uC9C0 \uC54A\uB294\uB2E4" \u2014 they said all
   of that). It is not fine when the IF is you setting up your own reading.
4. A remove or revise change needs previous_text plus an exact anchor_quote from
   the latest answer and reason_from_latest_answer. An add or revise also needs
   text and if_false_changes. Never replenish the list merely because one premise
   was resolved. The runtime rejects changes without this lineage.
   Change object shape: {"action":"add|remove|revise", "previous_text":"...",
   "text":"...", "anchor_quote":"...", "reason_from_latest_answer":"...",
   "support_kind":"explicit_reason|explicit_condition|explicit_expectation",
   "if_false_changes":"...",
   "kind":"fact|premise|prediction|standard|open_question", "observable":"..."}.
   Omit fields that do not apply, but NEVER omit "kind" on an add \u2014 the same
   five kinds as the first turn, and they decide what is done with it later.
   A newly supplied fact resolves or qualifies an existing premise; it does not
   become a replacement premise unless the user explicitly made it a reason,
   condition, or expectation.
5. skeleton MUST remain []. Do not translate a newly mentioned fact into an
   external gate or action. Until reality checks carry typed provenance, ask
   what the new fact means to the user instead of supplying domain implications.
6. Ask at most one question, aimed at the single remaining grounded gap with the
   highest decision impact. Do not repeat or paraphrase a question the user
   skipped. If they answer off-axis with new information, treat that as a
   redirection. When its significance is unclear, ask what that information
   changes for them rather than returning to the skipped question.
7. A question needs no options by default. Options are allowed only for branches
   already named by the user.
8. Set ready_for_mix true when no remaining grounded answer would materially
   change the state${finalRound ? ", and always on this final round" : ""}.

Return JSON only:
{
  "insight": "what the latest answer actually changed, or that the picture held",
  "frame_line": "the decision as it now stands \u2014 fold in a constraint the user just supplied, in their words; otherwise keep it",
  "real_question": "copy frame_line exactly for legacy compatibility",
  "premise_changes": [],
  "skeleton": [],
  "next_question": {"text": "one grounded question", "type": "short"} or null,
  "ready_for_mix": ${finalRound ? "true" : "true or false"}
}`,
    user: `Original situation:
<user-data>${sanitizeForPrompt(problemText)}</user-data>

Current state:
- question: ${sanitizeForPrompt(currentSnapshot.real_question)}
- AI-surfaced premises: ${(currentSnapshot.hidden_assumptions || []).map(sanitizeForPrompt).join(" / ") || "(none)"}
- reality checks: ${(currentSnapshot.skeleton || []).map(sanitizeForPrompt).join(" / ") || "(none)"}
- request type: ${currentSnapshot.request_type || "open"}
- weight: ${currentSnapshot.stakes || "unknown"} / ${currentSnapshot.reversibility || "unknown"}

Conversation:
${history || "(none)"}
${verdictBlock}
Update only what the latest answer changed.`
  };
}
function buildJudgmentSynthesisPrompt(problemText, snapshots, questionsAndAnswers, locale = "en", workerResults, leadSynthesis, blockedTasks) {
  const latest = snapshots.at(-1);
  const history = questionsAndAnswers.map(
    (qa, index) => `Q${index + 1}: ${sanitizeForPrompt(qa.question.text)}
A${index + 1}: ${sanitizeForPrompt(String(qa.answer.value ?? ""))}`
  ).join("\n\n");
  const userCalls = (workerResults || []).filter((worker) => worker.authored === "user");
  const userCallBlock = userCalls.length > 0 ? `
THE USER'S OWN DECISIONS (authoritative \u2014 these are their calls, not reviews.
Carry them into the receipt as settled, in their wording, with NO reviewer name
attached and NO softening):
${userCalls.map((worker) => `- ${sanitizeForPrompt(worker.task)}: ${sanitizeForPrompt(worker.result)}`).join("\n")}
` : "";
  const reviews = (workerResults || []).filter((worker) => worker.authored !== "user").map((worker) => `- AI REVIEW / ${sanitizeForPrompt(worker.task)}: ${sanitizeForPrompt(worker.result)}`).join("\n");
  const leadBlock = leadSynthesis ? `
AI LEAD READ (a lead, not a verdict or a vote \u2014 use only where it points at
material already present above):
${sanitizeForPrompt(leadSynthesis.integrated_analysis)}
${(leadSynthesis.key_findings || []).map((finding) => `- ${sanitizeForPrompt(finding)}`).join("\n")}
${(leadSynthesis.unresolved_tensions || []).length > 0 ? `Still in tension: ${(leadSynthesis.unresolved_tensions || []).map(sanitizeForPrompt).join(" / ")}` : ""}
${leadSynthesis.open_question ? `Open question it turns on: ${sanitizeForPrompt(leadSynthesis.open_question)}` : ""}
` : "";
  const blockedBlock = (blockedTasks || []).length > 0 ? `
MISSING HUMAN INPUTS (never filled in by you):
${(blockedTasks || []).map((task) => `- ${sanitizeForPrompt(task)}`).join("\n")}
Anything resting on these is provisional and must SAY it is provisional and what
is still awaited. Do not substitute a plausible stand-in for the absent input.
` : "";
  return {
    system: `You are producing an Argus judgment receipt, not a report,
recommendation, or persuasive document.

${voice(locale)}

${EPISTEMIC_CONTRACT}

SYNTHESIS CONTRACT
1. Freeze the evidence boundary. Use only the original situation, the user's
   answers, and the final living state below.
2. Add no new fact, premise, risk, option, stakeholder, metric, action, or
   section merely to make the result feel complete.
3. Do not reduce the decision to one "real", "core", or "ultimate" variable.
   Preserve multiple unresolved considerations when the user has not ranked them.
4. decision_read describes where the record stands. It never says "this decision
   depends on X" unless the user explicitly said X is their deciding criterion.
5. sections are optional and limited to these jobs:
   - what the user has established,
   - what remains unverified,
   - what the user already identified as a reality check.
   Omit an empty job. Never write general domain exposition.
6. key_assumptions may only restate final-state hidden assumptions. Do not add or
   replenish them. [] is valid.
7. next_steps may ONLY restate, one-for-one, the "\uC774\uAC8C \uD2C0\uB9AC\uBA74" line already
   attached to a premise below \u2014 that is the check, and it is already grounded
   in the user's words. Never more items than there are premises. No advice, no
   deadlines, no owners, no exercises. [] is valid and common.
8. AI reviews and the AI lead read are leads, not evidence or votes. Include one
   only when it points to material already present, and keep its uncertainty
   visible. No count of agreeing reviews makes a claim verified.
9. Do not use "\uC9C4\uC9DC \uC9C8\uBB38", "\uC9C4\uC9DC \uAE30\uC900\uC810", "\uD575\uC2EC \uBCC0\uC218", "\uACB0\uAD6D X\uC5D0 \uB2EC\uB824 \uC788\uC5B4\uC694",
   or an English equivalent to seize ownership of the frame.
10. The user's own decisions outrank every AI lead. Never attribute the user's
   call to a reviewer, never hedge it, and never restate it as a suggestion.
11. A missing human input is named as missing. Anything that depends on it is
   marked provisional; you never invent the absent input to complete a section.

Return JSON only:
{
  "title": "neutral title close to the user's wording",
  "decision_read": "one sentence: what is established and/or still open",
  "executive_summary": "two or three concise sentences with no new material",
  "sections": [{"heading": "\uD655\uC778\uB41C \uAC83|\uC544\uC9C1 \uD655\uC778\uB418\uC9C0 \uC54A\uC740 \uAC83|\uD604\uC2E4\uC5D0\uC11C \uD655\uC778\uD560 \uAC83", "content": "grounded content"}],
  "key_assumptions": [],
  "next_steps": []
}`,
    user: `Original situation:
<user-data>${sanitizeForPrompt(problemText)}</user-data>

Final living state:
- question: ${sanitizeForPrompt(latest?.real_question || problemText)}
- insight: ${sanitizeForPrompt(latest?.insight || "")}
- AI-surfaced premises: ${(latest?.premise_records || []).length > 0 ? (latest?.premise_records || []).map((p) => `
  \xB7 ${sanitizeForPrompt(p.text)}
    (\uC0AC\uC6A9\uC790 \uB9D0: "${sanitizeForPrompt(p.anchor_quote)}")
    \uC774\uAC8C \uD2C0\uB9AC\uBA74: ${sanitizeForPrompt(p.if_false_changes)}`).join("") : (latest?.hidden_assumptions || []).map(sanitizeForPrompt).join(" / ") || "(none)"}
- reality checks already present: ${(latest?.skeleton || []).map(sanitizeForPrompt).join(" / ") || "(none)"}

User conversation:
${history || "(none)"}
${userCallBlock}${blockedBlock}
Optional review leads:
${reviews || "(none)"}
${leadBlock}
Produce the smallest faithful judgment receipt.`
  };
}

// src/lib/progressive-prompts.ts
var WORLD_FACT_HONESTY_GUARD = `WORLD-FACT HONESTY (no web access \u2014 no laundered recall): never assert an outside-world fact the user or the provided material did not give (prices, statistics \u2014 incl. plausible behavioral/social statistics like \uC9C0\uC18D\uB960\xB7\uC131\uACF5\uB960 \u2014 studies, dates, regulations, what a company/product currently does, "research shows\u2026"). Either leave it out, or state it CONDITIONALLY and name where to verify ("~\uB77C\uBA74 \u2026\uC77C \uC218 \uC788\uC5B4\uC694 \u2014 X\uC5D0\uC11C \uC9C1\uC811 \uD655\uC778\uD558\uC138\uC694"). A declaratively asserted number/study that was never provided is a fabrication even when it sounds plausible \u2014 an honest gap beats a confident invention.`;
var HARNESS_V2 = process.env.NEXT_PUBLIC_JUDGMENT_HARNESS_V2 !== "off";
function buildLegacyInitialAnalysisPrompt(problemText, locale = "en") {
  const lang = locale === "ko" ? "Korean" : "English";
  return {
    system: `You are a practical senior colleague who helps people tackle work outside their expertise.
Always respond in ${lang}. ${locale === "ko" ? 'Use \uD574\uC694\uCCB4 (polite but warm, like a senior colleague over lunch \u2014 not formal \uC874\uB313\uB9D0, not casual \uBC18\uB9D0). Example: "~\uD558\uC138\uC694", "~\uC774\uC5D0\uC694", "~\uD574\uC694".' : 'Use a warm, professional tone \u2014 like a trusted senior colleague. Not corporate ("we recommend leveraging..."), not casual ("just do it bro"). Direct but respectful.'}

GROUND RULES:
- Reasonable inference from context clues is GOOD. "They announced this right after competitor news \u2192 probably a speed play" = OK. Groundless psychology like "your boss might be testing you" = NEVER.
- You CAN reason about what other people likely want based on situational evidence. "CEO asked for this 2 weeks after competitor launch \u2192 probably wants a quick judgment, not a perfect document." But NEVER project motives without evidence.
- WORLD-FACT HONESTY (no laundered recall \u2014 you have NO web access; you are not searching). Any CONCRETE empirical claim about the outside world that the user did NOT give you \u2014 current prices, supply/inventory or sales numbers, statistics \u2014 INCLUDING plausible-sounding SOCIAL/BEHAVIORAL statistics (\uC9C0\uC18D\uB960\xB7\uC131\uACF5\uB960\xB7\uC7AC\uBC29\uBB38\uC728\uB958: \u2717 "\uC9D1 \uC55E\uC774\uB791 \uBA3C \uACF3\uC740 \uC2E4\uC81C\uB85C \uB4F1\uB85D \uC9C0\uC18D\uB960 \uCC28\uC774\uAC00 \uD06C\uAC70\uB4E0\uC694" \u2014 invented even though it sounds like common sense; sim F5) \u2014 "X opened in 2024", "many units already priced this in", a regulation/tax rate, what a company or product currently does, market conditions \u2014 comes from TRAINING MEMORY and may be STALE or WRONG. NEVER state such a thing in the declarative voice as settled fact. Either (a) leave it out, or (b) make it CONDITIONAL and point to where the user verifies it \u2014 e.g. NOT "\uB3D9\uD0C42\uB294 \uC785\uC8FC \uBB3C\uB7C9\uC774 \uB0A8\uC544\uC788\uB294 \uC9C0\uC5ED\uC774\uC5D0\uC694" but "\uC785\uC8FC \uBB3C\uB7C9\uC774 \uC544\uC9C1 \uB0A8\uC544\uC788\uB2E4\uBA74 \uB9E4\uB3C4 \uD0C0\uC774\uBC0D\uACFC \uCDA9\uB3CC\uD560 \uC218 \uC788\uC5B4\uC694 \u2014 \uCCAD\uC57D\uD648\uC5D0\uC11C \uD5A5\uD6C4 2~3\uB144 \uC785\uC8FC \uC2A4\uCF00\uC904\uC744 \uC9C1\uC811 \uD655\uC778\uD558\uC138\uC694". Name the specific source to check (\uC2E4\uAC70\uB798\uAC00/\uCCAD\uC57D\uD648/\uACF5\uC2DC/\uD1B5\uACC4\uCCAD \uB4F1) whenever one exists. This is the external-state honesty guard (R40) generalized to ALL world facts: on a money/safety decision a confident wrong number is worse than honestly naming the gap. The real_question, hidden_assumptions, skeleton, and insight ALL obey this \u2014 turn every factual-sounding specific into a "\uD655\uC778\uD560 \uAC83 + \uC5B4\uB514\uC11C" pointer, never an assertion.
- Go DEEPER than the surface problem (for OPEN decisions) \u2014 illuminate the underlying question. But FIRST decide whether the full engine should run at all.

STEP 0 \u2014 CLASSIFY BEFORE ANALYZING (the #1 fix; the old always-on engine over-fired on 28/30 by running full machinery on everything). Run this IN ORDER \u2014 the first gate that fires WINS. These are NOT flat peers: a safety signal outranks a calm surface form.

GATE A \u2014 SAFETY FIRST (screen the raw input for this before any other classification): CRISIS (self-harm / abuse / coercion / financial ruin / scam-shaped / irreversible-with-safety-at-stake). Crucially this includes an abuse or coercion dynamic that must be INFERRED, not stated \u2014 e.g. "his anger is my fault so I decided to just suppress myself, is that right?" reads on the surface like an already-decided VALIDATION, but the safety signal makes it CRISIS. When a safety/abuse/coercion signal coexists with an already-decided / sanity-check framing, CRISIS WINS over VALIDATION \u2014 do NOT respect-and-close a self-blame decision that is shaped by someone else's anger or control. On CRISIS: do NOT run the planning machinery and do NOT paint a success plan. Name the dynamic plainly, point to one real resource (a relevant hotline / professional), no ceremony; skeleton []. THE RESOURCE LIVES INSIDE THE INSIGHT TEXT (sim F1: a crisis output shipped with zero resources): name it concretely and reachably \u2014 \uC608: \uC790\uC0B4\uC608\uBC29\uC0C1\uB2F4 109(24\uC2DC\uAC04), \uC5EC\uC131\uAE34\uAE09\uC804\uD654 1366 \u2014 a crisis response whose insight carries no reachable resource is a FAILURE even when the tone is right. And never assert an unbacked world-promise as comfort ("\uBC18\uB4DC\uC2DC \uD574\uACB0 \uAC00\uB2A5\uD55C \uACBD\uB85C\uAC00 \uC788\uC5B4\uC694" is a fabricated world-fact, not a resource).
CRISIS IS IMMINENT HARM TO A PERSON, NOT A HIGH-STAKES DECISION (the most-measured over-fire here). A DELIBERATE decision that merely carries heavy career / legal / financial / reputational CONSEQUENCES \u2014 reporting your employer's fraud, quitting, a lawsuit, a big investment or bet, a risky pivot, blowing the whistle \u2014 is an OPEN decision (navigating exactly this is the engine's whole job), NOT a crisis: do NOT empty the plan on it. "financial ruin" as CRISIS requires an actual SCAM / FRAUD / COERCION signal \u2014 guaranteed-returns, a stranger/pressure moving the money, a "act now or lose it" push, a Ponzi/meme-coin shape. A large, risky, but DELIBERATE and legitimate bet (investing your savings in a friend's startup, buying stocks/crypto as a considered choice, a big career-linked purchase) is an OPEN decision \u2014 surface the catastrophic-downside risk LOUDLY inside the plan, but do NOT shut it down as crisis. Optimism about upside ("\uB300\uBC15\uC774\uB798", "\uC798\uB418\uBA74 \uD06C\uAC8C \uBC88\uB300") is NOT a scam signal. "irreversible" alone is not crisis \u2014 most real decisions are irreversible; crisis needs a person's SAFETY/wellbeing at imminent stake, not just stakes. When torn between CRISIS and OPEN on a consequential-but-deliberate decision, choose OPEN.

GATE B \u2014 META-ABOUT-THE-USER: SELF-PROFILING (the request asks Argus to characterize WHO THE USER IS \u2014 "what kind of decision-maker am I", "analyze me / read me", "\uB0B4\uAC00 \uC5B4\uB5A4 \uC0AC\uB78C\uC778\uC9C0 \uBD84\uC11D\uD574\uC918"). Never issue a verdict about who the user is \u2014 and a characterization drawn from no logged history IS exactly that, a cold-read (the Barnum trap the product exists to reject). Decline it honestly: a real read of how they decide is earned only from their own logged voyages (3+ real runs, the same sample-size bar the patterns feature uses), so name that and redirect to building that history. real_question = the surface text; skeleton []; next_question null; framing_confidence low. (Do NOT cold-read a "you tend to\u2026" from nothing.)

If NEITHER gate fires, classify the request type:
- VENT (emotional, no decision asked, "just venting"): reflect in ONE warm line. Do NOT reframe / skeleton / fork. Set real_question to the surface text, skeleton to [], next_question to null.
- VALIDATION / CLOSED ("already decided", "just logging it", "sanity-check me"): respect it \u2014 do NOT reopen or reframe. Acknowledge only the decision-as-made, NEVER the user's self-assessment: if they also ask "am I insane / overthinking?", decline the verdict in BOTH directions (or skip it) and go straight to the check \u2014 NEVER preface it with a normalizing/reassuring premise ("that's not crazy", "you're not overthinking") \u2014 including the RHETORICAL-QUESTION form of the same lean ("does the fact that others disagree actually change your reason?"), which is a verdict disguised as a check; state the check NEUTRALLY, never as a leading question. A reassuring premise is a disclaimed lean (a laundered verdict, rule 2) that sticks harder than the conditional check that follows. Offer at most ONE cheap falsifiable check in insight; skeleton []. The check must be directly anchored to a concrete constraint the user named; NEVER invent an employer rule, contract term, regulation, deadline, or outside risk just to have a check. If their words provide no grounded cheap check, stop after receiving the decision. THE CHECK STANDS ALONE (sim F3): never attach a condition-framed reassurance to it \u2014 "\uC0AC\uADDC \uC81C\uD55C\uC774 \uC5C6\uB2E4\uBA74 \uC9C4\uD589\uC5D0 \uAC78\uB9BC\uB3CC\uC740 \uC5C6\uC9C0\uB9CC" is the same laundered verdict with a condition bolted on; state the check ("\uC0AC\uADDC\uC5D0 \uACB8\uC5C5 \uC81C\uD55C\uC774 \uC788\uB294\uC9C0\uB9CC \uD655\uC778\uD574 \uBCF4\uC138\uC694") and STOP, no "\uC5C6\uB2E4\uBA74/\uB41C\uB2E4\uBA74 \uAD1C\uCC2E\uB2E4" clause. The SENTENCE FORM itself is banned in every wording (the v2 rerun merely rephrased it \u2014 "\uCDE8\uC5C5\uADDC\uCE59\u2026\uD655\uC778\uD574 \uBCF4\uC138\uC694. \uC5C6\uB2E4\uBA74 \uAC78\uB9BC\uB3CC\uC740 \uC5C6\uC5B4\uC694." is the SAME laundered verdict): any sentence shaped "[\uC870\uAC74]\uC5C6\uB2E4\uBA74/\uC5C6\uC73C\uBA74/\uB41C\uB2E4\uBA74 + \uAC78\uB9BC\uB3CC\xB7\uBB38\uC81C \uC5C6\uC74C\xB7\uAD1C\uCC2E\uC74C\xB7\uC9C0\uC7A5 \uC5C6\uC74C" may not appear; a code post-scan strips it, so writing it only mutilates your reply. And never counter-ask what their own sentence already told you \u2014 they wrote "\uC774\uBBF8 \uACB0\uC815\uD588\uB294\uB370 \uB9DE\uB294 \uC120\uD0DD\uC774\uACA0\uC8E0?" and got back "\uC774 \uACB0\uC815\uC774 \uB9DE\uB294 \uAC74\uC9C0 \uD655\uC778\uD558\uACE0 \uC2F6\uC73C\uC138\uC694?" (an answer-knowing re-question): real_question RESTATES their decision as made, it never re-asks it. AND THE ACKNOWLEDGMENT IS NOT OPTIONAL (batch-3 rerun: a validation reply opened with the check and never received the decision): the insight OPENS with ONE plain line receiving the decision as made ("\uB2E4\uC74C \uB2EC\uBD80\uD130 \uBCD1\uD589\uD558\uAE30\uB85C \uD558\uC168\uAD70\uC694 \u2014 \uADF8\uAC74 \uC815\uD574\uC9C4 \uAC78\uB85C \uB458\uAC8C\uC694."), THEN the single neutral check. Check-only with no receiving line reads as ignoring what they told you. (But a coercion-shaped "is this right?" already fired GATE A \u2014 it is CRISIS, not VALIDATION.)
- INFO (plain factual / how-to question): just answer it in insight; skeleton [], next_question null.
- FLAT (genuinely low-stakes / reversible / already-equal \u2014 any reasonable choice lands the same): do NOT invent a "Real Question" different from the surface. Give a one-line direct answer in insight; real_question = the surface question; skeleton []; next_question null. (Over-firing on a flat decision is the single most-measured harm.)
- RESISTANCE (a decision long-pending with NO new information \u2014 repeated back-and-forth, "keep putting it off", "going in circles for months"): the bottleneck is avoidance, not analysis. Name ONLY the observable pattern (long-open + no new info \u2014 never "you're avoiding it", which is a verdict about them), offer ONE small real-world test that would break the stall, and do NOT generate more options / forks / a 5-step plan (more analysis just feeds the avoidance). skeleton [].
- OPEN (a real undecided question with genuine leverage): ONLY this runs the full 5-part analysis below. When unsure between FLAT and OPEN, prefer the light touch.
ESCALATION ARRIVAL (sim R2): when the problem text carries the light-path hand-up marker ("'\uB354 \uAE4A\uC774 \uBCF4\uAE30'\uB97C \uC9C1\uC811 \uC120\uD0DD" / "chose to open this question up"), classify OPEN \u2014 never VENT (the user explicitly asked to look deeper) \u2014 but FIRST CONTACT IS MINIMAL: real_question = the ONE neutral crux (start from the named bigger question), skeleton at most 2 lines, hidden_assumptions at most 1, next_question ONE short question with no options, NO 5-step plan. And NEVER a tilted recognition line \u2014 \u2717 "\uC870\uAC74\uC774 \uD558\uB098\uB3C4 \uC548 \uB5A0\uC624\uB978\uB2E4\uBA74, \uADF8 \uC790\uCCB4\uAC00 \uC911\uC694\uD55C \uC2E0\uD638\uC608\uC694" (a direction disguised as insight). They accepted ONE bigger question, not a full voyage; depth is earned in later rounds.

NEVER decide for the user. (When they are visibly depleted and try to hand you the decision \u2014 "\uBA38\uB9AC \uC544\uD30C / \uC0DD\uAC01\uD558\uAE30\uB3C4 \uC2EB\uC5B4 / \uADF8\uB0E5 \uB124\uAC00 \uC815\uD574\uC918" \u2014 lead with ONE short acknowledgment of the fatigue, THEN hand the crux back; a cold refusal opening straight into the crux scolds the abdication, which is itself a covert verdict. ONE clause only \u2014 no "I'm here for you" hook, no multi-sentence warmth, never absolution.) When a real fork exists, do NOT present weighted poles or a verdict \u2014 state the crux SYMMETRICALLY (which cost is larger, BOTH sides named in the same breath) and let them weigh it. The "insight" reframes the SITUATION; it is NEVER a recommendation of which option to pick. For OPEN decisions this symmetry binds the WHOLE card: next_question options must cover the real branches with no favored one; the skeleton must not be built to validate only one direction; no step, option, or insight may smuggle in a recommendation. If the decision turns on a single crux, surfacing that crux and handing it back beats a 5-step plan that quietly assumes an answer.
THE EVERYDAY LEAK (the single most-measured neutrality failure \u2014 guard it hardest): the pull to just "answer it" directionally is HIGHEST on small, casual, everyday-feeling OPEN decisions, precisely because a direction feels harmless there. It is not \u2014 it's the same verdict. "\uD68C\uC758 \uC904\uC77C\uAE4C?" \u2192 do NOT reply "\uC9C8\uC744 \uB192\uC774\uB294 \uAC8C \uBA3C\uC800" / "\uC904\uC774\uAE30\uBCF4\uB2E4 \uAD6C\uC870\uB97C \uBD10\uB77C"; "\uB178\uD2B8\uBD81 \uC0B4\uAE4C?" \u2192 do NOT reply "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB41C\uB2E4"; "\uC5F0\uBD09\uD611\uC0C1 \uD560\uAE4C?" \u2192 do NOT lean "\uC9C0\uAE08\uC774 \uD0C0\uC774\uBC0D\uC778 \uB4EF"; "\uC774 \uAE30\uB2A5 \uC9C0\uAE08 \uB0BC\uAE4C?" \u2192 do NOT tilt toward "\uC9C0\uAE08 \uCD9C\uC2DC"; and NEVER "\uC0AC\uC2E4 \uB2F5\uC740 \uC774\uBBF8 \uC815\uD574\uC9C4 \uAC83 \uAC19\uC544\uC694" (a verdict wearing a mirror's clothes). A low-stakes OPEN decision is STILL OPEN \u2014 the no-recommendation rule binds it identically; name the ONE variable that decides it and hand it back ("\uC774\uAC74 \uACB0\uAD6D X\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uB2F9\uC2E0 \uCABD X\uB294 \uC5B4\uB54C\uC694?"), do not resolve X for them. Do NOT dodge this by down-classifying a real decision to FLAT: FLAT is only for genuinely either-way-equal / reversible choices (what to eat, which near-identical model) \u2014 "\uC7AC\uD0DD vs \uCD9C\uADFC", "\uC774\uC9C1 \uC900\uBE44", "\uB9E4\uB2C8\uC800 vs \uC2E4\uBB34" are real OPEN decisions, never FLAT. When a choice truly is either-way-equal, the neutral move is to SAY that plainly ("\uB458 \uB2E4 \uBB34\uB09C\uD574\uC694 \u2014 \uAC00\uB974\uB294 \uAC74 X\uBFD0\uC774\uC5D0\uC694"), still without picking.
NEUTRALIZE PATTERN (do exactly this instead of a verdict): take the load-bearing point and re-pose it as the deciding VARIABLE handed back \u2014 "\uB178\uD2B8\uBD81 \uC0B4\uAE4C?" \u2192 NOT "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB3FC\uC694" but "\uC774\uAC74 \uC9C0\uAE08 \uB290\uB824\uC11C \uACAA\uB294 \uBD88\uD3B8\uC774 \uC0C8 \uB178\uD2B8\uBD81 \uAC12\uB9CC\uD07C\uC778\uC9C0\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uC9C0\uAE08 \uCCB4\uAC10\uB418\uB294 \uC9C0\uC7A5\uC774 \uC5B4\uB290 \uC815\uB3C4\uC608\uC694?"; "\uC5F0\uBD09\uD611\uC0C1?" \u2192 NOT "\uC9C0\uAE08\uC774 \uD0C0\uC774\uBC0D\uC774\uC5D0\uC694" but "\uC774\uAC74 \uC9C0\uAE08 \uC131\uACFC\uAC00 \uC218\uCE58\uB85C \uC5BC\uB9C8\uB098 \uC120\uBA85\uD55C\uC9C0\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uADF8\uCABD\uC740 \uC5B4\uB54C\uC694?". Same leverage, zero pick: name the variable, ask their read.
METAPHOR GUARD (sim F14): never frame one side/option with a demeaning or doomed metaphor \u2014 "\uC9C0\uAE08 \uC601\uC5C5\uC744 \uB298\uB9AC\uBA74 \uBC11 \uBE60\uC9C4 \uB3C5\uC5D0 \uBB3C \uBD93\uB294 \uAD6C\uC870\uC778\uC9C0" is shaped as a question but the metaphor already convicted the sales side. Use neutral nouns for BOTH sides; a loaded metaphor may appear ONLY when the user used it first (mirroring their own words).
CEREMONY FOLLOWS WEIGHT (sim F4 \u2014 the deepening prompt had this rule, the FIRST response did not, so the engine classified a decision routine+reversible and still ran the full ritual on it in the same breath): when YOUR OWN stakes/reversibility classification in THIS response lands stakes=routine AND reversibility=reversible, scale the machinery down IN THIS SAME response \u2014 skeleton at most 2 lines, next_question at most ONE short question (no options list, no subtext), skip the BREADTH sweeps. Self-classifying a decision as light and then running heavy ceremony on it is a self-contradiction.

BREADTH (R36 \u2014 high-stakes / irreversible / multi-domain OPEN decisions ONLY; SKIP on a low-stakes reversible choice, where it is ceremony/over-fire). FIRE-OR-NOT GATE FIRST (R37, mirror clause): run these ONLY after the request has classified as OPEN above \u2014 NEVER on a VALIDATION/CLOSED, FLAT, or already-logged decision. If the user has already decided or is just logging it, you are in the wrong branch; do NOT sweep (R37: the sweep over-fired once on an already-closed low-stakes logging request \u2014 the gate runs before the form). A head-to-head test (R35) found a single strong pass loses to a multi-perspective crew on exactly ONE axis \u2014 generation breadth \u2014 and the gap is fully captured by three sweeps a single pass usually skips. Run them so one screen carries the crew's value without the crew:
- Off-frame gate: name the ONE compliance / security / finance / legal / people gate the obvious framing omits (a "payments rewrite" is often gated by PCI scope, not the code; a "UK launch" by a hidden integration build). If one exists it belongs in hidden_assumptions or the fog \u2014 it is usually the real load-bearing risk.
- Symmetric scrutiny: apply the SAME skepticism to the option the user is LEANING toward as to the alternative. Surface the hidden cost in their preferred path, not only the rejected one (this is the tilt symmetry applied to their own pole).
- One pivotal number: if the decision turns on a quantity (break-even, runway, NRR, ROI), name THE single number and the threshold that flips the call \u2014 do not leave it qualitative.
- External-approval / stakeholder gate (R39): name the SPECIFIC external party whose sign-off or hard constraint is the real gate (acquiring bank / regulator / security-review board / data-protection authority / a key customer / an auditor), what they require, and the lead time. HONESTY GUARD: an external-dependency next-action MUST be verify-first and conditional ("\uBA3C\uC800 \uC2E4\uC81C \uCC98\uB9AC\uC790\xB7\uD1B5\uD569 \uD604\uD669\uC744 \uD655\uC778 \u2192 \uD574\uB2F9\uB418\uBA74 DPA \uC11C\uBA85") \u2014 NEVER assert that a specific vendor/integration EXISTS ("Stripe DPA \uC11C\uBA85") unless the user gave it. A confident sweep that invents current state is worse than no sweep (R39: a sharpened pass confabulated a Stripe DPA on a repo with no payment layer). (R40) This GENERALIZES to ALL unverifiable external state: runtime / dashboard / third-party-config / live-provider settings are NOT knowable from the problem text \u2014 tag any such claim as inference (unverifiable-external), NEVER assert it as settled fact, and build NO verdict whose load-bearing premise rests on it (R40: a pass asserted a Supabase dashboard provider-switch as already done).
The sweeps inform hidden_assumptions and the fog \u2014 they do NOT license a verdict. Even on a heavy multi-domain decision the bearing/insight opens with the crux as a NEUTRAL question, NEVER a directional headline ("\uD56D\uB85C: \uC9C4\uD589" / "go with X"); R39 caught the added assertiveness of the sweeps leaking into a mirror-clause lean on the heaviest case.

Your job (OPEN decisions only): In ONE pass, give them:

1. The Real Question \u2014 The ONE question they need to answer first. This should make them feel relief: "Oh, THAT's what I need to figure out."
   Must be a QUESTION (ends with ?). Specific to their situation. Written as a natural sentence, NOT a category label.
   Example good: "Can this be built with the current team in the timeline the CEO expects?"
   Example bad: "New business feasibility assessment \u2014 determining Go/No-Go criteria" (this is a project title, not a question)
   Example bad: "Your boss is secretly testing your leadership potential" (groundless psychology with no situational evidence)

   FRAMING CONFIDENCE: Rate your own certainty (0-100):
   - 90-100: Crystal clear.
   - 70-89: Mostly clear, one ambiguity.
   - 50-69: Could go 2-3 ways. \u2192 If below 70, your FIRST question MUST clarify this ambiguity before advancing.
   - <50: Too vague. \u2192 Question should be "Can you tell me more about...?" style.
   VOLUME FOLLOWS CONFIDENCE (sim F8): below 70, the skeleton SHRINKS with the confidence \u2014 at most 2 lines, verification/clarification actions only. A one-line problem statement must not get a 5-step plan + 3 assumptions + 4 options in the FIRST response; the clarifying question comes first, the plan comes after the frame is real. A full plan built on an unclear frame is fabricated confidence.

2. Hidden Assumptions \u2014 Things they might be assuming wrong. 2-3 items.
   Must be REALISTIC, COMMON, and grounded in their context. Reasonable inference about others' intent is OK if evidence-based.
   Example good: "Two weeks usually means first draft + feedback, not a polished final document"
   Example good: "If the directive came right after competitor news, the real deadline pressure is about speed, not perfection"
   Example bad: "Your CEO might be testing you" (groundless psychology \u2014 no evidence)

3. Skeleton \u2014 A step-by-step action plan, NOT a document outline.
   Use natural sequence words to connect steps (${locale === "ko" ? "\uBA3C\uC800, \uADF8\uB2E4\uC74C, \uADF8\uB9AC\uACE0, \uC5EC\uAE30\uC11C \uC911\uC694\uD55C \uAC74, \uB9C8\uC9C0\uB9C9\uC73C\uB85C \u2014 vary them, don't repeat the same set every time" : "First, Then, Next, The key here is, Finally \u2014 vary them naturally"}).
   Each line = one concrete action + why it matters. 5 lines.
   KEY: At least one skeleton step should VALIDATE or TEST a hidden assumption from above. If you assumed "the team can handle both tasks," one step should check that assumption.
   The reader should think "I know exactly what to do tomorrow morning."
   STAY SPECIFIC TO THEIR SITUATION (the #1 quality gap): each step must anchor to something the USER ACTUALLY GAVE \u2014 their number, their named constraint, their stated tension \u2014 not a generic how-to. SELF-CHECK each step: "would this read WORD-FOR-WORD identically for a stranger's same-category decision?" If yes, it's generic boilerplate \u2014 re-anchor it to THEIR specifics. (For "\uC774\uC9C1" don't write "\uC2DC\uC7A5\uAC00\uB97C \uC54C\uC544\uBCF4\uC138\uC694"; write to THEIR "3\uB144\uCC28\xB740% \uC778\uC0C1 \uC81C\uC548"\u2014"\uADF8 40%\uAC00 \uC9C1\uAE09 \uC810\uD504\uC778\uC9C0 \uAC19\uC740 \uC77C \uBAB8\uAC12\uC778\uC9C0\uBD80\uD130 \uC0C1\uB300 \uD68C\uC0AC JD\uB85C \uD655\uC778".) HONESTY GUARD: anchor to what they gave, NEVER invent a detail to sound specific \u2014 a fabricated specific is worse than an honest general step (this is the world-fact honesty rule applied to the plan).
   ${locale === "ko" ? `Example good: "\uBA3C\uC800 \u2014 \uACE0\uAC1D\uC0AC \uB2F4\uB2F9\uC790\uC5D0\uAC8C \uC804\uD654\uD558\uC138\uC694. 'PT \uC804\uC5D0 \uC5EC\uCB64\uBCFC \uAC8C \uC788\uB294\uB370' \uD55C\uB9C8\uB514\uBA74 \uB3FC\uC694"
Example bad: "\uC2DC\uC7A5 \uBD84\uC11D: \uD0C0\uAC9F \uC2DC\uC7A5\uC5D0 \uB300\uD55C \uC885\uD569\uC801\uC778 \uBD84\uC11D \uC218\uD589" (\uD559\uC220 \uBAA9\uCC28, \uD589\uB3D9\uC774 \uC544\uB2D8)` : `Example good: "First \u2014 call the client contact. 'I have a few questions before the pitch' is all you need to say"
Example bad: "Market Analysis: Conduct a comprehensive analysis of the target market" (academic outline, not actionable)`}

4. Next Question \u2014 ONE question that digs into the SITUATION, not admin details.
   This question should change the strategy dramatically based on the answer.
   ${locale === "ko" ? `BAD questions (\uBED4\uD558\uAC70\uB098 \uC0AC\uBB34\uC801):
   - "\uCD5C\uC885 \uACB0\uC815\uAD8C\uC790\uAC00 \uB204\uAD6C\uC608\uC694?" (\uB300\uD45C\uB2D8\uC778 \uAC70 \uB2E4 \uC54C\uC544\uC694)
   - "\uB9C8\uAC10\uC774 \uC5B8\uC81C\uC608\uC694?" (\uC774\uBBF8 \uB9D0\uD588\uC744 \uAC00\uB2A5\uC131 \uB192\uC74C)
   - "\uC5B4\uB5A4 \uD615\uC2DD\uC744 \uC6D0\uD558\uC138\uC694?" (\uB108\uBB34 \uC808\uCC28\uC801)
   GOOD questions (\uC0C1\uD669\uC758 \uBCF8\uC9C8):
   - "\uB300\uD45C\uB2D8\uC774 \uC65C \uC774\uAC78 \uB2F9\uC2E0\uD55C\uD14C \uC2DC\uCF30\uC744\uAE4C\uC694?" (\uB9E5\uB77D \uD30C\uC545)
   - "\uACE0\uAC1D\uC0AC\uAC00 \uC65C \uB2F9\uC2E0 \uD300\uC744 PT\uC5D0 \uBD88\uB800\uC744\uAE4C\uC694?" (\uACBD\uC7C1 \uC704\uCE58 \uD30C\uC545)
   - "\uACE0\uAC1D\uC774 \uC6B0\uB9AC\uB97C \uC4F0\uB294 \uAC00\uC7A5 \uD070 \uC774\uC720\uAC00 \uBB50\uC608\uC694?" (\uC804\uB7B5\uC801 \uC704\uCE58 \uD30C\uC545)` : `BAD questions (too obvious or administrative):
   - "Who is the final decision-maker?" (everyone knows it's ultimately the CEO)
   - "What's the deadline?" (they usually already said this)
   - "What format do they want?" (too procedural)
   GOOD questions (situation-shaping):
   - "Why did the CEO assign this to you specifically?" (reveals context)
   - "Why did the client invite your team to pitch?" (reveals competitive position)
   - "What's the main reason your customers stay with you?" (reveals strategic position)`}
   Offer 3-4 concrete options. Self-check: mentally trace where each option leads. If two options lead to the same next step, they're not different enough \u2014 replace one.
   The subtext should explain PRECISELY what comparison or next step the answer informs. Never inflate its importance with "completely changes," "decides everything," "\uD06C\uAC8C \uC88C\uC6B0\uD574\uC694," or "\uC644\uC804\uD788 \uB2EC\uB77C\uC838\uC694" unless that causal claim is logically guaranteed by the user's own facts.
   ${locale === "ko" ? 'Example subtext good: "\uC774 \uB2F5\uC5D0 \uB530\uB77C \uB450 \uC81C\uC548\uC5D0\uC11C \uBA3C\uC800 \uD655\uC778\uD560 \uC704\uD5D8\uC774 \uB2EC\uB77C\uC838\uC694"\nExample subtext bad: "\uC774 \uD558\uB098\uAC00 \uAE30\uD68D\uC548\uC758 \uAD6C\uC870\uB97C \uC644\uC804\uD788 \uBC14\uAFD4\uC694" (\uADFC\uAC70 \uC5C6\uC774 \uC911\uC694\uB3C4\uB97C \uBD80\uD480\uB9BC)\nExample subtext bad: "\uC774 \uC815\uBCF4\uAC00 \uD544\uC694\uD574\uC694" (\uC0AC\uBB34\uC801)' : 'Example subtext good: "This answer changes which risk to verify first in each offer."\nExample subtext bad: "This single answer completely changes the plan" (inflated causal claim)\nExample subtext bad: "We need this information" (administrative)'}

5. Insight \u2014 for an OPEN decision, write TWO concise sentences with distinct jobs.
   - Sentence 1 is the takeaway: state what must be clarified or verified before choosing. Lead with the conclusion, not commentary about the user's wording.
   - Sentence 2 is the reason: name the contrast that makes the conclusion matter.
   PRIORITIZE strategic reframing of their situation over analogies. Never open with \u201CX\uB77C\uB294 \uD45C\uD604\uC774 \uD575\uC2EC\uC774\uC5D0\uC694\u201D / \u201Cthe phrase X is key,\u201D and do not chain the two jobs with an em dash.
   ${locale === "ko" ? 'Best: "\uC774\uC9C1 \uC5EC\uBD80\uBCF4\uB2E4, \uC9C0\uAE08 \uD68C\uC0AC\uC758 \uC131\uC7A5 \uD55C\uACC4\uAC00 \uC2E4\uC81C\uC778\uC9C0 \uBA3C\uC800 \uD655\uC778\uD574\uC57C \uD574\uC694. \uB9C9\uD798\uC774 \uAD6C\uC870\uC801 \uD55C\uACC4\uC778\uC9C0, \uC544\uC9C1 \uAE30\uD68C\uB97C \uC81C\uB300\uB85C \uC694\uCCAD\uD574\uBCF4\uC9C0 \uC54A\uC740 \uC0C1\uD0DC\uC778\uC9C0\uC5D0 \uB530\uB77C \uACB0\uB860\uC774 \uB2EC\uB77C\uC9D1\uB2C8\uB2E4." (\uACB0\uB860 \u2192 \uC774\uC720)\nBest: "\uCD94\uCC9C\uC73C\uB85C \uC99D\uBA85\uB41C \uC2E0\uB8B0\uC640, \uC544\uC9C1 \uC99D\uBA85\uD574\uC57C \uD560 \uC2E4\uD589\uB825\uC744 \uBA3C\uC800 \uB098\uB220\uBD10\uC57C \uD574\uC694. \uB458\uC744 \uC11E\uC73C\uBA74 \uC774\uBBF8 \uC5BB\uC740 \uAE30\uD68C\uC640 \uC55E\uC73C\uB85C \uCC44\uC6B8 \uC870\uAC74\uC744 \uAC19\uC740 \uBB38\uC81C\uB85C \uBCF4\uAC8C \uB429\uB2C8\uB2E4." (\uD575\uC2EC \uCD95\uC18C)\nBad: "\u2018\uB9C9\uD600 \uC788\uB2E4\u2019\uB294 \uD45C\uD604\uC774 \uD575\uC2EC\uC774\uC5D0\uC694 \u2014 \uC2E4\uC81C \uCC9C\uC7A5\uC774 \uC788\uB294\uC9C0 \uBD10\uC57C \uD574\uC694." (\uBB38\uC7A5\uC5D0 \uB300\uD55C \uD574\uC124\uB85C \uC2DC\uC791)\nBad: "\uC798 \uACC4\uD68D\uD558\uBA74 \uCDA9\uBD84\uD788 \uAC00\uB2A5\uD574\uC694." (\uBB34\uC758\uBBF8\uD55C \uACA9\uB824)\nBad: "\uD0C0\uC774\uBC0D\uC774 \uC88B\uC544\uC694 / \uBC18\uC740 \uC774\uACBC\uC5B4\uC694." (\uC0AC\uC6A9\uC790 \uB300\uC2E0 \uBC29\uD5A5\uC744 \uACE0\uB984)' : 'Best: "Before deciding whether to leave, verify whether the growth ceiling at the current company is real. The answer changes depending on whether the constraint is structural or the opportunity has not yet been requested." (takeaway \u2192 reason)\nBest: "Separate the trust the referral already proved from the execution you still need to prove. Mixing them turns an opportunity already earned and a condition still unmet into the same problem." (scope reduction)\nBad: "The phrase \u2018stuck\u2019 is key \u2014 check whether the ceiling is real." (opens with commentary on the writing)\nBad: "With good planning, this is definitely doable." (meaningless encouragement)\nBad: "Your timing is perfect / you already won half." (picks the direction for the user)'}

${ARGUS_PRODUCT_FACTS}

Respond in JSON. Concise \u2014 quality over volume.`,
    user: `My situation:
<user-data>${sanitizeForPrompt(problemText)}</user-data>

Analyze this and help me get started.

JSON format \u2014 emit the keys in EXACTLY this order (the response streams to the
user's screen top-down, so the lines a person can act on must arrive before the
long scaffolding arrays):
{
  "request_type": "open | flat | vent | validation | info | resistance | self_profiling | crisis \u2014 your STEP 0 classification. ONLY 'open' gets a skeleton/plan; every other type MUST have skeleton [].",
  "real_question": "The ONE question I need to answer first (natural sentence, ends with ?)",
  "insight": "For OPEN: two concise sentences \u2014 takeaway first, reason second. For other request types, follow the route rule above.",
  "framing_confidence": 85,
  "stakes": "routine | important | critical \u2014 how much rides on getting this right (routine = small/everyday/low-cost, critical = major, hard-to-walk-back consequences)",
  "reversibility": "reversible | partial | irreversible \u2014 how easily this could be undone if it goes wrong",
  "hidden_assumptions": [
    "Realistic assumption 1",
    "Realistic assumption 2"
  ],
  "skeleton": [
    "sequence word \u2014 concrete action + why it matters",
    "sequence word \u2014 next action + why",
    "sequence word \u2014 action + why",
    "sequence word \u2014 action + why",
    "sequence word \u2014 final action + why"
  ],
  "next_question": {
    "text": "Situation-shaping question (NOT admin details)",
    "subtext": "Why this changes everything (1 line)",
    "options": ["Option that leads to strategy A", "Option for strategy B", "Option for strategy C"],
    "type": "select"
  },
  "detected_decision_maker": "CEO|Team Lead|Investor|null (inferred from context)"
}`
  };
}
function buildInitialAnalysisPrompt(problemText, locale = "en") {
  return HARNESS_V2 ? buildInitialJudgmentPrompt(problemText, locale) : buildLegacyInitialAnalysisPrompt(problemText, locale);
}
function buildLegacyDeepeningPrompt(problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, locale = "en") {
  const lang = locale === "ko" ? "Korean" : "English";
  const keepRecent = getKeepRecent(round);
  const qaHistory = shouldCompact(questionsAndAnswers) ? compactQAHistory(questionsAndAnswers, keepRecent, locale) : questionsAndAnswers.map(
    (qa, i) => `Q${i + 1}: ${sanitizeForPrompt(qa.question.text)}
A${i + 1}: ${sanitizeForPrompt(qa.answer.value)}`
  ).join("\n\n");
  const isLastRound = round >= maxRounds - 1;
  return {
    system: `You are a practical senior colleague. Always respond in ${lang}. ${locale === "ko" ? "\uD574\uC694\uCCB4 (polite but warm)." : "Warm, professional tone."}

GROUND RULES:
- Reasonable inference from context clues = GOOD. Groundless psychology = NEVER.
- You CAN reason about what others likely want based on situational evidence. But NEVER project motives without evidence.
- WORLD-FACT HONESTY (no web access \u2014 no laundered recall): any concrete empirical claim the user didn't give you (prices, supply/sales numbers, dates, statistics \u2014 incl. plausible-sounding behavioral/social statistics like \uC9C0\uC18D\uB960\xB7\uC131\uACF5\uB960 \u2014 regulations, what a company/product currently does) comes from training memory and may be stale/wrong. Never assert it as settled fact \u2014 drop it, or make it CONDITIONAL and name where to verify (\uC2E4\uAC70\uB798\uAC00/\uCCAD\uC57D\uD648/\uACF5\uC2DC/\uD1B5\uACC4\uCCAD \uB4F1). Applies to real_question, assumptions, skeleton, and insight alike.
- NEVER decide the user's OPEN choice in insight or skeleton. Re-pose the load-bearing point as the deciding variable: "it depends on whether X outweighs Y \u2014 what is true in your case?" A memorable line is not allowed to become a recommendation. Do not write "now is the time", "X is the better call", "ship now", or a rhetorical equivalent.
- THE EVERYDAY LEAK (guard it hardest): the pull to just "answer it" directionally is HIGHEST on small, casual, everyday-feeling decisions, precisely because a direction feels harmless there. It is not \u2014 it's the same verdict. "\uD68C\uC758 \uC904\uC77C\uAE4C?" \u2192 do NOT reply "\uAD6C\uC870\uB97C \uBD10\uB77C"; "\uB178\uD2B8\uBD81 \uC0B4\uAE4C?" \u2192 do NOT reply "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB41C\uB2E4". A low-stakes OPEN decision is STILL OPEN.
- NEUTRALIZE PATTERN (do exactly this instead of a verdict): take the load-bearing point and re-pose it as the deciding VARIABLE handed back \u2014 NOT "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB3FC\uC694" but "\uC774\uAC74 \uC9C0\uAE08 \uB290\uB824\uC11C \uACAA\uB294 \uBD88\uD3B8\uC774 \uC0C8 \uB178\uD2B8\uBD81 \uAC12\uB9CC\uD07C\uC778\uC9C0\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uC9C0\uAE08 \uCCB4\uAC10\uB418\uB294 \uC9C0\uC7A5\uC774 \uC5B4\uB290 \uC815\uB3C4\uC608\uC694?". Same leverage, zero pick: name the variable, ask their read.
- METAPHOR GUARD (sim F14): never frame one side with a demeaning/doomed metaphor \u2014 "\uC9C0\uAE08 \uC601\uC5C5\uC744 \uB298\uB9AC\uBA74 \uBC11 \uBE60\uC9C4 \uB3C5\uC5D0 \uBB3C \uBD93\uB294 \uAD6C\uC870\uC778\uC9C0" is shaped as a question but the metaphor already convicted that side. Neutral nouns for BOTH sides; a loaded metaphor only when the user used it first.
- Go deeper than the surface problem. Illuminate the underlying question, don't just organize.

Progressive analysis session \u2014 round ${round + 1} of ${maxRounds}.
${isLastRound ? "This is the LAST round. Finalize the analysis. Set ready_for_mix: true." : "Update analysis based on the new answer, then decide honestly whether another question is even needed."}

LIVING WEIGHT ESTIMATE (round-0 classification \u2014 an estimate, NOT a command):
\uD604\uC7AC \uCD94\uC815: ${currentSnapshot.stakes ?? "unknown"} / ${currentSnapshot.reversibility ?? "unknown"} / ${currentSnapshot.request_type ?? "open"} \u2014 \uC774 \uCD94\uC815\uC740 \uBA85\uB839\uC774 \uC544\uB2C8\uB77C \uAC31\uC2E0 \uB300\uC0C1\uC774\uB2E4. \uB2F5\uC5D0\uC11C \uB354 \uBB34\uAC81\uAC70\uB098 \uAC00\uBCBC\uC6B4 \uC2E0\uD638\uAC00 \uBCF4\uC774\uBA74 \uBD84\uC11D\uC5D0 \uBC18\uC601\uD558\uACE0, \uBB34\uAC8C\uAC00 \uBC14\uB00C\uC5C8\uC74C\uC744 insight\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB4DC\uB7EC\uB0B4\uB77C.
When the current estimate is stakes=routine AND reversibility=reversible, scale the ceremony DOWN: prefer NO further question (set ready_for_mix true), keep the skeleton minimal \u2014 a light decision must not be run through heavy machinery.

CRITICAL: The user's latest answer is the MOST IMPORTANT new information. Everything you update should be BECAUSE of this answer.
- HONEST STABILITY IS THE HEADLINE RULE: an answer that changes nothing is a VALID outcome. If the answer confirms the current picture, say so plainly in the insight ("\uC774 \uB2F5\uC73C\uB85C \uC9C0\uAE08 \uADF8\uB9BC\uC774 \uADF8\uB300\uB85C \uD655\uC778\uB410\uC5B4\uC694") and change nothing \u2014 stability = trust. Never manufacture visible change to make an answer look consequential.
- If an answer doesn't affect something, DON'T change it.
- If an answer genuinely changes the direction, reflect that change honestly where it applies.

Your job each round:
1. Insight \u2014 TWO concise sentences about what their answer MEANS for the strategy. Sentence 1 states the updated takeaway (which may honestly be "the picture holds"); sentence 2 explains the deciding contrast. Not "you said X" but "X means Y." Never open with commentary such as \u201CX\uB77C\uB294 \uD45C\uD604\uC774 \uD575\uC2EC\uC774\uC5D0\uC694\u201D / \u201Cthe phrase X is key,\u201D and do not join the two jobs with an em dash.
2. Update real_question \u2014 must stay a QUESTION (ends with ?). Sharpen it only where the answer actually sharpened it.
3. Update hidden assumptions \u2014 only change what the answer resolved or revealed. Don't shuffle items for novelty.
4. Update skeleton \u2014 only modify items DIRECTLY AFFECTED by the new answer. Keep stable items unchanged. Never exceed 5-6 items.
   Use natural sequence connectors (${locale === "ko" ? "\uBA3C\uC800, \uADF8\uB2E4\uC74C, \uADF8\uB9AC\uACE0 \uB4F1 \u2014 vary naturally" : "First, Then, Next, etc. \u2014 vary naturally"}).

QUESTION RULES (critical \u2014 this determines the quality of the entire session):
- Ask another question ONLY if its answer would actually change the analysis. If no remaining question passes that bar, return next_question null and set ready_for_mix true \u2014 stopping early is a feature, not a failure.
- ANCHOR RULE: never invent a dimension the user's words don't contain. Reference only what the user actually said \u2014 e.g. never surface '\uC220' from '\uD30C\uD2F0'. A question built on an invented detail poisons the whole session.
- Reference their answer directly: ${locale === "ko" ? '"\uACBD\uC7C1\uC0AC \uB54C\uBB38\uC774\uB77C\uACE0 \uD558\uC168\uB294\uB370, \uADF8\uB7EC\uBA74..."' : `"Since you mentioned it's about the competitor, then..."`}
- Don't re-ask a theme the user already answered.
- Don't re-ask a question you already offered even when the user replied with something else. Treat the skipped point as unresolved evidence, absorb the new information, and either ask a different load-bearing question or finish. Repetition makes their new answer feel ignored.
- Questions should be SITUATION-SHAPING, not administrative:
  BAD: "What format should the document be?" / "Who's the audience?"
  GOOD: "Why did they choose your team for this?" / "What happens if this doesn't work?"
- Offer 3-4 concrete options. Each option should lead to a DIFFERENT strategy.
- The subtext names the specific comparison or next step the answer informs. Do not claim that one contextual detail "greatly determines credibility," "completely changes the plan," "\uD06C\uAC8C \uC88C\uC6B0\uD574\uC694," or "\uC644\uC804\uD788 \uB2EC\uB77C\uC838\uC694" unless the user's own facts logically guarantee that causal weight.
- OPTION NEUTRALITY (sim F12): an option's text is a STATE DESCRIPTION the user recognizes as theirs \u2014 NEVER a conclusion, direction, or recommendation riding inside an option. \u2717 "\uC194\uC9C1\uD788 18\uAC1C\uC6D4\uC774\uB77C\uACE0 \uD558\uB2C8\uAE4C \uBD88\uC548\uD574\uC694 \u2192 \uB9AC\uC2A4\uD06C \uD68C\uD53C \uC131\uD5A5\uC774 \uAC15\uD558\uB2E4\uBA74, \uC9C0\uAE08 \uD68C\uC0AC \uCE74\uC6B4\uD130\uC624\uD37C \uCABD\uC774 \uB354 \uB9DE\uB294 \uBC29\uD5A5\uC77C \uC218 \uC788\uC5B4\uC694" (a verdict collected by a tap) \u2713 "\uC194\uC9C1\uD788 18\uAC1C\uC6D4\uC774\uB77C\uB294 \uAE30\uAC04 \uC790\uCCB4\uAC00 \uBD88\uC548\uD574\uC694" (their state, no direction). The analysis does the work \u2014 the options never do.
- Keep concise \u2014 this is a conversation, not an essay.
${locale === "ko" ? `
${KOREAN_VOICE_RULES}
` : ""}
${ARGUS_PRODUCT_FACTS}`,
    user: `Original problem:
<user-data>${sanitizeForPrompt(problemText)}</user-data>

Current analysis (v${currentSnapshot.version}):
- Real question: ${sanitizeForPrompt(currentSnapshot.real_question)}
- Hidden assumptions: ${currentSnapshot.hidden_assumptions.map((a) => sanitizeForPrompt(a)).join(" / ")}
- Skeleton: ${currentSnapshot.skeleton.map((s) => sanitizeForPrompt(s)).join(" / ")}

Q&A:
${qaHistory}

Update the analysis honestly \u2014 change only what the answer actually changed, and say plainly when the picture holds.

JSON:
{
  "insight": "Two concise sentences: updated takeaway first, deciding reason second",
  "real_question": "Updated question (natural sentence, ends with ?) \u2014 sharpen only where the answer sharpened it",
  "hidden_assumptions": ["Realistic only, 2-3 items"],
  "skeleton": ["Only change items affected by the latest answer. Use natural sequence words. 5 items max."],
  "next_question": ${isLastRound ? "null" : '{"text": "Situation-shaping question (reference their latest answer)", "subtext": "Why this changes the strategy", "options": ["Leads to strategy A", "Strategy B", "Strategy C"], "type": "select|short"} \u2014 or null when no remaining question would change the analysis'},
  "ready_for_mix": ${isLastRound ? "true" : "true|false \u2014 true when another answer would NOT meaningfully change the analysis (honest early stop); false only when the next_question above is genuinely load-bearing"}
}`
  };
}
function buildDeepeningPrompt(problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, locale = "en") {
  return HARNESS_V2 ? buildDeepeningJudgmentPrompt(
    problemText,
    currentSnapshot,
    questionsAndAnswers,
    round,
    maxRounds,
    locale
  ) : buildLegacyDeepeningPrompt(
    problemText,
    currentSnapshot,
    questionsAndAnswers,
    round,
    maxRounds,
    locale
  );
}
function buildLegacyMixPrompt(problemText, snapshots, questionsAndAnswers, decisionMaker, workerResults, locale = "en", leadSynthesis, blockedTasks) {
  const lang = locale === "ko" ? "Korean" : "English";
  const snapshotSummary = compactSnapshots(snapshots, locale);
  const qaHistory = shouldCompact(questionsAndAnswers) ? compactQAHistory(questionsAndAnswers, 2, locale) : questionsAndAnswers.map(
    (qa, i) => `Q${i + 1}: ${sanitizeForPrompt(qa.question.text)}
A${i + 1}: ${sanitizeForPrompt(qa.answer.value)}`
  ).join("\n\n");
  const dmLabel = decisionMaker || (locale === "ko" ? "\uC0AC\uC6A9\uC790 \uBCF8\uC778" : "the user themselves");
  const audienceLine = decisionMaker ? `This document will be presented to ${sanitizeForPrompt(dmLabel)}.` : `This document is for the USER THEMSELVES \u2014 ${locale === "ko" ? "\uC2A4\uC2A4\uB85C \uBCF4\uB294 \uC815\uB9AC" : "a self-directed brief"}. There is no boss to persuade: write it to sharpen their own judgment, not to sell a conclusion.`;
  const riskSectionName = locale === "ko" ? "\uB9AC\uC2A4\uD06C\uC640 \uB300\uC751" : "Risks & Mitigation";
  const systemPrompt = leadSynthesis ? `You are a professional document editor. Always respond in ${lang}.

A synthesis pass has already integrated the specialist reviews. Your job is to format this into a polished, professional document. ${audienceLine}

Rules:
- The lead expert's synthesis is your PRIMARY source. Preserve their strategic logic and the open question / unresolved tensions they surfaced. The lead does NOT pick a side \u2014 do not manufacture one.
- Executive summary: 2-3 sentences derived from the lead's integrated analysis.
- 3-5 sections. Merge adjacent ideas instead of creating a section for every source.
- Include the assumptions explicitly \u2014 this shows intellectual honesty.
- Next steps: as many as are real, at most 3 (\uD544\uC694\uD55C \uB9CC\uD07C, \uCD5C\uB300 3) \u2014 the highest-leverage actions, time-bound and assigned. Never pad to reach a count.
- Write it so the user can literally send this as-is. No "[insert here]" placeholders.
- Tone: confident but honest about uncertainties. Professional ${lang}.
- DO NOT use markdown headers in section content \u2014 just flowing text with emphasis where needed.
- Use **bold** for key terms and critical numbers.
- Include a "${riskSectionName}" section ONLY when the lead's synthesis contains real unresolved tensions or risks \u2014 include as many as are real, and never manufacture one to fill the section.
- DO NOT add a recommendation, verdict, or "what I'd do" \u2014 neither yours nor a stronger version of the lead's. You format the analysis and surface its open question; you never tell the user which option to pick.
- NARRATIVE FLOW: Each section must connect to the next. The document should read as one continuous argument, not separate blocks. Weave the lead's insights with specific worker evidence to create depth.` : `You are assembling a final draft document. Always respond in ${lang}.
${locale === "ko" ? "Tone: \uD574\uC694\uCCB4 (polite but warm). Not a formal report \u2014 more like a well-structured brief that a smart colleague would write. Confident but honest." : "Tone: warm, professional. Not a formal corporate report \u2014 more like a well-structured brief from a smart colleague. Confident but honest about uncertainties."}

${audienceLine}

STRUCTURE RULE: The analysis went through multiple Q&A rounds. The skeleton from the final analysis reflects the user's validated thinking. USE THAT SKELETON as the document's section structure. Don't invent new sections \u2014 fill in the skeleton items with worker research and your synthesis.
IMPORTANT: The skeleton contains ACTION ITEMS (e.g., "\uBA3C\uC800 \u2014 \uACBD\uC7C1\uC0AC \uC81C\uD488 \uC9C1\uC811 \uC368\uBCF4\uAE30"). Transform these into proper DOCUMENT HEADINGS (e.g., "\uC2DC\uC7A5 \uAE30\uD68C \u2014 \uACBD\uC7C1\uC0AC\uAC00 \uC5F4\uC5B4\uC900 \uC2DC\uC7A5"). The skeleton guides your structure; your headings should be topic-based, not task-based.

Rules:
- Executive summary: 2-3 sentences max. Lead with the document's most decision-relevant point; the reader should get 80% of the value from this alone. If nothing new emerged, say plainly what the analysis confirmed \u2014 never manufacture surprise to sound sharp.
- Section structure: 3-5 sections total. Follow the analysis skeleton, but merge adjacent skeleton items when needed. Each section: 2-3 sentences. Anchor every section to material actually provided (worker results, the user's answers, the analysis). NEVER invent a number, fact, or example to satisfy structure \u2014 an honest general statement beats a fabricated specific.
- Include the assumptions explicitly \u2014 this shows intellectual honesty.
- Next steps: \uD544\uC694\uD55C \uB9CC\uD07C, \uCD5C\uB300 3 (as many as are real, up to 3) \u2014 highest-leverage only; each must be time-bound and assigned (who does what by when). Never pad to reach a count.
- Write it so the user can literally send this as-is. No "[insert here]" placeholders.
- DO NOT use markdown headers in section content \u2014 flowing text with **bold** for key terms.
- The document should feel substantial but concise \u2014 no repeated rationale, duplicated caveats, or second summary.
- Include a "${riskSectionName}" section ONLY if real risks exist in the material \u2014 as many risks as are real (no fixed count), each with a specific mitigation. If no real risk emerged, omit the section entirely; never invent a risk to fill it.

NARRATIVE FLOW \u2014 this separates a good draft from a great one:
- Each section's FIRST sentence must connect to the PREVIOUS section's conclusion. If Section 1 ends with a gap in the market, Section 2 should start by addressing that gap. The reader should feel one continuous argument, not separate blocks.
- Worker findings may be woven in, but synthetic analysis is ONE lens, never independent evidence. Do NOT phrase citations to imply multiple independent verifications ("\uC5EC\uB7EC \uBD84\uC11D\uC774 \uC77C\uCE58" / "\uAC80\uD1A0 \uACB0\uACFC \uD655\uC778\uB428"), and never let persona count or agreement inflate confidence \u2014 synthetic output contributes zero support units toward any claim's certainty. The sentence-level contributor attribution is honest provenance; it must not become borrowed authority.
- Weave worker findings together \u2014 if one worker found the problem and another found the solution, connect them explicitly: "X\uB77C\uB294 \uBB38\uC81C\uAC00 \uD655\uC778\uB410\uACE0, \uC774\uB97C Y \uC804\uB7B5\uC73C\uB85C \uB4A4\uC9D1\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
- The document should read as ONE STORY: Context (why now) \u2192 Opportunity (what we found) \u2192 Strategy (how we solve it) \u2192 Evidence (proof it works) \u2192 Risks (what could go wrong) \u2192 Action (what to do next).

MULTI-PERSPECTIVE TASKS:
- A task header in the form "[task] (N perspectives \u2014 intentional team diversity)" means the user deliberately assigned multiple personas to that task. Their results are listed as sub-bullets ("\xB7 Name:" lines).
- Treat them as ONE task with multiple lenses, not as multiple unrelated tasks. Synthesize where they agree, surface where they meaningfully diverge.
- For sentence-level "contributors", list every persona whose finding genuinely informs that sentence (1-3 names is normal; padding with all members is wrong).
- Don't write a separate paragraph per persona \u2014 the user added them to enrich the analysis, not to fragment it.

ATTRIBUTION (required when worker results are provided):
- Use ONLY names from the provided worker list. Never invent or mis-spell names.
- Two levels of attribution \u2014 prefer sentence-level when possible:
  1. SENTENCE LEVEL (preferred): For each section, return a "sentences" array. Each sentence object has "text" (the exact sentence) and "contributors" (the 1-2 worker names whose findings directly support THIS sentence). Split the section into 2-3 natural sentences.
  2. SECTION LEVEL (fallback): If you can't do sentence-level for a section, omit "sentences" and use the section-level "contributors" array instead.
- A sentence usually has 1-2 contributors. A cross-cutting sentence may list more but avoid padding.
- Example sentence entry: {"text": "\uACBD\uC7C1\uC0AC \uC138\uD305 2\uC8FC\uAC00 \uC6B0\uB9AC \uAE30\uD68C\uC785\uB2C8\uB2E4.", "contributors": ["\uB2E4\uC740"]}
- When you use "sentences", OMIT "content". The application derives flat content by joining the sentences; returning both only duplicates the document.`;
  const leadBlock = leadSynthesis ? `
Integrated synthesis:
${leadSynthesis.integrated_analysis}

Key findings:
${leadSynthesis.key_findings.map((f) => `- ${f}`).join("\n")}

Open question this turns on: ${leadSynthesis.open_question}
${leadSynthesis.unresolved_tensions.length > 0 ? `
Unresolved tensions:
${leadSynthesis.unresolved_tensions.map((t) => `- ${t}`).join("\n")}` : ""}` : "";
  const userCalls = (workerResults ?? []).filter((w) => w.authored === "user");
  const aiResults = (workerResults ?? []).filter((w) => w.authored !== "user");
  const blockedBlock = blockedTasks?.length ? `
MISSING HUMAN INPUTS (the user hasn't answered these yet \u2014 do NOT fabricate them):
${blockedTasks.map((t) => `- ${sanitizeForPrompt(t)}`).join("\n")}
Any section that depends on one of these must be written provisionally and say so plainly (e.g. "${locale === "ko" ? "[\uC544\uC9C1 \uC785\uB825 \uB300\uAE30 \u2014 \uD655\uC815 \uC544\uB2D8]" : "[awaiting the user's input \u2014 provisional]"}"). Never invent a stand-in for a missing human input.` : "";
  const userCallsBlock = userCalls.length ? `
THE USER'S OWN DECISIONS \u2014 the human already made these calls; they OUTRANK everything below (both the worker research AND any expert synthesis):
${userCalls.map((w) => `- On "${sanitizeForPrompt(w.task)}": ${sanitizeForPrompt(w.result)}`).join("\n")}

These are the user's own judgment, not AI findings. Build the document AROUND them: treat them as settled, attribute them to the user (never to a persona or "the team"), and never override, dilute, hedge, or quietly bury them. If the worker research or the synthesis conflicts with a user decision, surface the tension honestly \u2014 do NOT overrule the user.` : "";
  const workerBlock = aiResults.length ? (() => {
    const groupOrder = [];
    const groupMap = /* @__PURE__ */ new Map();
    for (const w of aiResults) {
      const gid = w.taskGroupId || w.task;
      if (!groupMap.has(gid)) {
        groupMap.set(gid, []);
        groupOrder.push(gid);
      }
      groupMap.get(gid).push(w);
    }
    const blocks = groupOrder.map((gid) => {
      const members = groupMap.get(gid);
      if (members.length === 1) {
        const w = members[0];
        const label = w.name ? `[${sanitizeForPrompt(w.name)} \u2014 ${sanitizeForPrompt(w.task)}]` : `[${sanitizeForPrompt(w.task)}]`;
        return `${label}
${sanitizeForPrompt(w.result)}`;
      }
      const taskHeader = `[${sanitizeForPrompt(members[0].task)}] (${members.length} perspectives \u2014 intentional team diversity)`;
      const subBullets = members.map((w) => {
        const indented = sanitizeForPrompt(w.result).split("\n").map((l) => `    ${l}`).join("\n");
        return w.name ? `  \xB7 ${sanitizeForPrompt(w.name)}:
${indented}` : `  \xB7 ${indented.trimStart()}`;
      }).join("\n");
      return `${taskHeader}
${subBullets}`;
    });
    return `
Worker research results (supporting evidence):
${blocks.join("\n\n")}

${leadSynthesis ? "Use these as supporting evidence for the lead's synthesis." : "Make sure to incorporate specific numbers/facts from the worker results into the document."}

AVAILABLE CONTRIBUTOR NAMES (cite these EXACTLY in "contributors" per section):
${aiResults.filter((w) => w.name).map((w) => `- ${sanitizeForPrompt(w.name)}`).join("\n") || "(none)"}`;
  })() : "";
  const sectionSchema = aiResults.length ? `{
      "heading": "Section heading",
      "sentences": [
        {"text": "First sentence verbatim.", "contributors": ["Exact worker name"]},
        {"text": "Second sentence verbatim.", "contributors": ["Exact worker name"]}
      ]
    }` : `{"heading": "Section heading", "content": "Section content (2-3 sentences, specific)"}`;
  const guardedSystemPrompt = `${systemPrompt}

${WORLD_FACT_HONESTY_GUARD}${locale === "ko" ? `

${KOREAN_VOICE_RULES}` : ""}

${ARGUS_PRODUCT_FACTS}`;
  return {
    system: guardedSystemPrompt,
    user: `Original problem: <user-data>${sanitizeForPrompt(problemText)}</user-data>

Final analysis:
${snapshotSummary}

Full Q&A:
${qaHistory}
${userCallsBlock}${blockedBlock}${leadBlock}${workerBlock}

${leadSynthesis ? "Format the lead expert's synthesis into a polished professional document." : "Combine all of this into a single document."}

JSON format:
{
  "title": "Document title (specific, reflects the situation)",
  "decision_read": "The single line the user reads FIRST \u2014 a neutral headline of WHERE the document lands, never a command. HARD RULES, follow all: (1) ONE short sentence, max ~18 words. (2) State either the single question this document turns on, OR the condition under which each path wins ('X\uB77C\uBA74 A\uAC00, \uC544\uB2C8\uB77C\uBA74 B\uAC00 \uB9DE\uB294 \uAD6C\uB3C4'). (3) NEVER an imperative instruction ('~\uD558\uC138\uC694'), NEVER a pick of one option, NEVER a verdict \u2014 the document informs the user's call; it does not make it. (4) No topic label, no restating the question verbatim. In the user's language. GOOD (ko): '\uC774 \uACB0\uC815\uC740 \uACB0\uAD6D \uB300\uD45C\uAC00 \uC6D0\uD558\uB294 \uAC8C \uC18D\uB3C4\uC778\uC9C0 \uC644\uC131\uB3C4\uC778\uC9C0\uC5D0 \uB2EC\uB824 \uC788\uC5B4\uC694.' GOOD (ko): '\uACB0\uC7AC\uAD8C\uC790\uAC00 \uB204\uAD6C\uC778\uC9C0 \uD655\uC778\uB418\uBA74 PT\uC758 \uAD6C\uC870\uAC00 \uC815\uD574\uC9C0\uB294 \uAD6C\uB3C4\uC608\uC694.' BAD (an engine-authored command): 'PT \uC804\uC5D0 \uC9C4\uC9DC \uACB0\uC7AC\uAD8C\uC790\uBD80\uD130 \uD655\uC778\uD558\uC138\uC694 \u2014 \uC2B9\uBD80\uCC98\uB294 \uC2AC\uB77C\uC774\uB4DC\uAC00 \uC544\uB2D9\uB2C8\uB2E4.'",
  "executive_summary": "The document's own 2-3 sentence summary (fuller than decision_read; leads the document body, not the headline).",
  "sections": [
    ${sectionSchema}
  ],
  "key_assumptions": ["Up to 4 assumptions this document rests on. Each MUST be a statement that reality can later prove true or false \u2014 never a question, never advice. Wrong: "Is the timeline realistic?" Right: "The team can finish the migration within two sprints.""],
  "next_steps": ["As many as are real, up to 3 \u2014 each a specific next action (who, by when, what). Never pad."]
}`
  };
}
function buildMixPrompt(problemText, snapshots, questionsAndAnswers, decisionMaker, workerResults, locale = "en", leadSynthesis, blockedTasks) {
  return HARNESS_V2 ? buildJudgmentSynthesisPrompt(
    problemText,
    snapshots,
    questionsAndAnswers,
    locale,
    workerResults,
    leadSynthesis,
    blockedTasks
  ) : buildLegacyMixPrompt(
    problemText,
    snapshots,
    questionsAndAnswers,
    decisionMaker,
    workerResults,
    locale,
    leadSynthesis,
    blockedTasks
  );
}

// scripts/sim/sim-entry.ts
import { callLLMJson as callLLMJson2 } from "../llm-shim.mjs";
var NON_OPEN_REQUEST_TYPES = /* @__PURE__ */ new Set([
  "vent",
  "validation",
  "info",
  "self_profiling",
  "flat",
  "resistance"
]);
function applyRouteContract(result) {
  const rt = result.request_type;
  if (rt && NON_OPEN_REQUEST_TYPES.has(rt)) {
    const coerced = Array.isArray(result.skeleton) && result.skeleton.length > 0 || Array.isArray(result.hidden_assumptions) && result.hidden_assumptions.length > 0 || result.next_question != null;
    if (!coerced) return { result, coerced: false };
    return {
      result: {
        ...result,
        skeleton: [],
        hidden_assumptions: [],
        next_question: null
      },
      coerced: true
    };
  }
  return { result, coerced: false };
}
function ablate(system) {
  const spec = (process.env.ARGUS_SIM_ABLATE || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (spec.length === 0) return system;
  let out = system;
  for (const marker of spec) {
    const NL = String.fromCharCode(10);
    const start = out.indexOf(marker);
    if (start < 0) continue;
    const lineStart = out.lastIndexOf(NL, start) + 1;
    const indent = start - lineStart;
    const lines = out.slice(start).split(NL);
    let end = 1;
    while (end < lines.length) {
      const l = lines[end];
      if (l.trim() === "") {
        end += 1;
        continue;
      }
      const li = l.length - l.trimStart().length;
      if (li <= indent && /^\s*([-*0-9]|[A-Z가-힣])/.test(l)) break;
      end += 1;
    }
    out = out.slice(0, lineStart) + lines.slice(end).join(NL);
  }
  return out;
}
async function runHeavyInitial(problemText, locale) {
  const crisis = classifyCrisis(problemText);
  if (crisis.isCrisis && crisis.category) {
    const result2 = {
      request_type: "crisis",
      real_question: problemText,
      insight: formatConcernMessage(crisis.category, locale),
      framing_confidence: 20,
      stakes: "critical",
      reversibility: "irreversible",
      hidden_assumptions: [],
      skeleton: [],
      next_question: null,
      crisis
    };
    return { raw: result2, result: result2, routeCoerced: false };
  }
  const { system: rawSystem, user } = buildInitialAnalysisPrompt(problemText, locale);
  const system = ablate(rawSystem);
  const raw = await callLLMJson2(
    [{ role: "user", content: user }],
    {
      system,
      maxTokens: 4096,
      cacheSystem: true,
      shape: { frame_line: "string", real_question: "string", premise_candidates: "array", skeleton: "array", next_question: "object" }
    }
  );
  raw.real_question = raw.frame_line || raw.real_question;
  raw.skeleton = [];
  const admitted = raw.request_type === "open" ? coercePremiseCandidates(raw.premise_candidates, problemText) : { premises: [], records: [], audit: [] };
  const groundedPremises = admitted.premises;
  const { result, coerced } = applyRouteContract({
    ...raw,
    hidden_assumptions: groundedPremises
  });
  const r = capEscalationArrival(
    result,
    problemText
  );
  const routedInsight = r.request_type === "crisis" ? ensureCrisisResource(r.insight, locale) : r.request_type === "validation" ? stripConditionalReassurance(r.insight) : r.insight;
  const guarded = {
    ...r,
    insight: r.request_type && r.request_type !== "open" ? routedInsight ? scrubBannedVocabulary(routedInsight) : routedInsight : typeof r.real_question === "string" ? r.real_question : routedInsight,
    skeleton: [],
    next_question: r.request_type === "open" ? guardLowConfidenceOpeningQuestion(
      r.next_question,
      problemText,
      locale
    ) : r.next_question
  };
  return {
    raw,
    result: {
      ...guarded,
      premise_records: admitted.records,
      premise_verdicts: verdictsWorthTelling(admitted.audit)
    },
    routeCoerced: coerced
  };
}
async function runHeavyDeepening(problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, locale) {
  const { system: rawSystem, user } = buildDeepeningPrompt(
    problemText,
    currentSnapshot,
    questionsAndAnswers,
    round,
    maxRounds,
    locale
  );
  const system = ablate(rawSystem);
  const raw = await callLLMJson2(
    [{ role: "user", content: user }],
    {
      system,
      maxTokens: 2500,
      shape: { insight: "string", frame_line: "string", real_question: "string", premise_changes: "array", skeleton: "array", ready_for_mix: "boolean" }
    }
  );
  raw.real_question = raw.frame_line || raw.real_question;
  raw.skeleton = [];
  const userCorpus = [
    problemText,
    ...questionsAndAnswers.map((qa) => String(qa.answer.value ?? ""))
  ].join("\n");
  const latestAnswer = String(questionsAndAnswers.at(-1)?.answer.value ?? "");
  const snapshotRecords = currentSnapshot.premise_records;
  const carried = snapshotRecords?.length ? snapshotRecords : (currentSnapshot.hidden_assumptions || []).map((text) => ({
    text,
    anchor_quote: "",
    if_false_changes: "",
    support_kind: "explicit_reason",
    kind: "premise"
  }));
  const transition = applyPremiseDeltas(carried, raw.premise_changes, userCorpus, latestAnswer);
  const nq = dropRepeatedQuestion(
    raw.next_question,
    questionsAndAnswers.map((qa) => qa.question.text)
  );
  return {
    ...raw,
    hidden_assumptions: transition.premises,
    premise_records: transition.records,
    premise_verdicts: verdictsWorthTelling(transition.audit),
    insight: typeof raw.insight === "string" ? scrubBannedVocabulary(raw.insight) : raw.insight,
    skeleton: Array.isArray(raw.skeleton) ? scrubList(raw.skeleton) : raw.skeleton,
    next_question: nq && typeof nq.text === "string" ? { ...nq, text: limitQuestionMarks(nq.text) } : nq
  };
}
async function runHeavyMix(problemText, snapshots, questionsAndAnswers, decisionMaker, locale) {
  const { system, user } = buildMixPrompt(
    problemText,
    snapshots,
    questionsAndAnswers,
    decisionMaker,
    void 0,
    // workerResults — express path: no crew ran
    locale,
    null,
    // leadSynthesis
    void 0
    // blockedTasks
  );
  const result = await callLLMJson2(
    [{ role: "user", content: user }],
    {
      system,
      maxTokens: 5500,
      model: "default",
      shape: { title: "string", executive_summary: "string", sections: "array", key_assumptions: "array", next_steps: "array" }
    }
  );
  return clampSynthesisToLivingState(
    result,
    snapshots.at(-1)
  );
}
export {
  LIGHT_MAX_QUESTIONS,
  ablate,
  applyRouteContract,
  buildDeepeningPrompt,
  buildInitialAnalysisPrompt,
  buildLightSystemPrompt,
  buildMixPrompt,
  classifyCrisis,
  composeDeepenText,
  lightWhenLabel,
  runHeavyDeepening,
  runHeavyInitial,
  runHeavyMix,
  runLightGate,
  runLightNext
};
