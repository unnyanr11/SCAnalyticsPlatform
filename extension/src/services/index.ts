/**
 * SC Analytics Platform — Services Barrel
 *
 * All interception system exports in one import.
 */

export { apiInterceptor,    ApiInterceptor }    from './ApiInterceptor';
export { responseParser,    ResponseParser }    from './ResponseParser';
export type { ParsedResponse, EndpointKind }    from './ResponseParser';
export { apiEmitter,        ApiEventEmitter }   from './ApiEventEmitter';
export type { ApiEventMap, ApiEventName, ApiEventPayload, ApiEventListener } from './ApiEventEmitter';
export { rateLimiter,       RateLimiter }       from './RateLimiter';
export type { BucketConfig }                    from './RateLimiter';
export { endpointRegistry,  EndpointRegistry }  from './EndpointRegistry';
export type { EndpointDescriptor }              from './EndpointRegistry';
export { interceptionCache, InterceptionCache } from './InterceptionCache';
export {
  validateMarketOffer,
  validateMarketSnapshot,
  validateResourceInfo,
  validateEconomyPhase,
  validateMarketOffers,
  validateResourceInfoArray,
  isSaneParsedResponse,
} from './SchemaValidator';
export type { ValidationResult }                from './SchemaValidator';
