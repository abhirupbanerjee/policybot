/**
 * OpenAPI YAML Parser
 *
 * Parses OpenAPI 3.0 specifications and converts them to DataAPIConfig format.
 */

import YAML from 'yaml';
import type {
  DataAPIConfig,
  DataAPIParameter,
  ResponseStructure,
  ResponseField,
  AuthConfig,
} from '../../types/data-sources';

// ===== Types =====

/**
 * Result of parsing an OpenAPI spec
 */
export interface ParsedOpenAPI {
  /** API name from info.title */
  name: string;
  /** API description from info.description */
  description: string;
  /** Base endpoint URL from servers[0].url */
  endpoint: string;
  /** HTTP method (first path, first method) */
  method: 'GET' | 'POST';
  /** Path from the spec */
  path: string;
  /** Authentication configuration */
  authentication: AuthConfig;
  /** Parameter definitions */
  parameters: DataAPIParameter[];
  /** Response structure */
  responseStructure: ResponseStructure;
  /** Sample response if provided */
  sampleResponse?: Record<string, unknown>;
  /** Original spec for reference */
  originalSpec: Record<string, unknown>;
}

/**
 * Validation result for OpenAPI spec
 */
export interface OpenAPIValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ===== OpenAPI Schema Types (minimal) =====

interface OpenAPISpec {
  openapi?: string;
  info?: {
    title?: string;
    description?: string;
    version?: string;
  };
  servers?: Array<{ url?: string; description?: string }>;
  paths?: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: Array<Record<string, string[]>>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  parameters?: ParameterObject[];
}

interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseObject>;
  security?: Array<Record<string, string[]>>;
}

interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaTypeObject>;
}

interface ResponseObject {
  description?: string;
  content?: Record<string, MediaTypeObject>;
}

interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
}

interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  $ref?: string;
}

interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
}

// ===== Validation =====

/**
 * Validate an OpenAPI specification
 */
export function validateOpenAPISpec(content: string): OpenAPIValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let spec: OpenAPISpec;
  try {
    spec = YAML.parse(content);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid YAML: ${error instanceof Error ? error.message : 'Parse error'}`],
      warnings: [],
    };
  }

  // Check required fields
  if (!spec.openapi) {
    warnings.push('Missing openapi version field');
  } else if (!spec.openapi.startsWith('3.')) {
    errors.push(`Unsupported OpenAPI version: ${spec.openapi}. Only OpenAPI 3.x is supported.`);
  }

  if (!spec.info?.title) {
    errors.push('Missing info.title - API name is required');
  }

  if (!spec.servers || spec.servers.length === 0 || !spec.servers[0].url) {
    errors.push('Missing servers[0].url - Base URL is required');
  }

  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    errors.push('Missing paths - At least one path is required');
  } else {
    // Check that at least one path has GET or POST
    const pathKeys = Object.keys(spec.paths);
    let hasValidMethod = false;
    for (const pathKey of pathKeys) {
      const path = spec.paths[pathKey];
      if (path.get || path.post) {
        hasValidMethod = true;
        break;
      }
    }
    if (!hasValidMethod) {
      errors.push('No GET or POST methods found in paths');
    }
  }

  // Warnings for optional but recommended fields
  if (!spec.info?.description) {
    warnings.push('Missing info.description - Consider adding a description');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ===== Parsing =====

/**
 * Parse an OpenAPI YAML string into a structured format
 */
export function parseOpenAPISpec(content: string): ParsedOpenAPI {
  // Validate first
  const validation = validateOpenAPISpec(content);
  if (!validation.valid) {
    throw new Error(`Invalid OpenAPI spec: ${validation.errors.join('; ')}`);
  }

  const spec: OpenAPISpec = YAML.parse(content);

  // Extract basic info
  const name = spec.info?.title || 'Unnamed API';
  const description = spec.info?.description || '';

  // Get base URL
  let endpoint = spec.servers?.[0]?.url || '';
  // Remove trailing slash
  endpoint = endpoint.replace(/\/$/, '');

  // Get first path with GET or POST
  const pathKeys = Object.keys(spec.paths || {});
  let selectedPath = pathKeys[0] || '/';
  let selectedMethod: 'GET' | 'POST' = 'GET';
  let operation: Operation | undefined;

  for (const pathKey of pathKeys) {
    const path = spec.paths![pathKey];
    if (path.get) {
      selectedPath = pathKey;
      selectedMethod = 'GET';
      operation = path.get;
      break;
    } else if (path.post) {
      selectedPath = pathKey;
      selectedMethod = 'POST';
      operation = path.post;
      break;
    }
  }

  // Combine base URL with path
  const fullEndpoint = `${endpoint}${selectedPath}`;

  // Parse parameters
  const pathItem = spec.paths?.[selectedPath];
  const allParams = [
    ...(pathItem?.parameters || []),
    ...(operation?.parameters || []),
  ];
  const parameters = parseParameters(allParams);

  // Parse response structure
  const responseStructure = parseResponseStructure(operation?.responses, spec.components?.schemas);

  // Extract sample response
  const sampleResponse = extractSampleResponse(operation?.responses);

  // Parse authentication
  const authentication = parseAuthentication(spec);

  return {
    name,
    description,
    endpoint: fullEndpoint,
    method: selectedMethod,
    path: selectedPath,
    authentication,
    parameters,
    responseStructure,
    sampleResponse,
    originalSpec: spec as Record<string, unknown>,
  };
}

/**
 * Parse parameters from OpenAPI spec
 */
function parseParameters(params: ParameterObject[]): DataAPIParameter[] {
  return params
    .filter(p => p.in === 'query' || p.in === 'path' || p.in === 'header')
    .map(p => ({
      name: p.name,
      type: mapSchemaTypeToParamType(p.schema?.type),
      in: p.in as 'query' | 'path' | 'header',
      description: p.description || '',
      required: p.required || false,
      default: p.schema?.default,
      example: p.example || p.schema?.example,
      allowedValues: p.schema?.enum,
    }));
}

/**
 * Map OpenAPI schema type to parameter type
 */
function mapSchemaTypeToParamType(
  schemaType?: string
): 'string' | 'integer' | 'number' | 'boolean' | 'array' {
  switch (schemaType) {
    case 'integer':
      return 'integer';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    default:
      return 'string';
  }
}

/**
 * Parse response structure from OpenAPI responses
 */
function parseResponseStructure(
  responses?: Record<string, ResponseObject>,
  schemas?: Record<string, SchemaObject>
): ResponseStructure {
  const defaultStructure: ResponseStructure = {
    jsonPath: '$',
    dataIsArray: false,
    fields: [],
  };

  if (!responses) return defaultStructure;

  // Look for 200 or 201 response
  const successResponse = responses['200'] || responses['201'] || responses['default'];
  if (!successResponse?.content) return defaultStructure;

  // Get JSON content
  const jsonContent = successResponse.content['application/json'];
  if (!jsonContent?.schema) return defaultStructure;

  const schema = resolveSchema(jsonContent.schema, schemas);

  // Determine if response is array or object
  const dataIsArray = schema.type === 'array';

  // Parse fields
  let fields: ResponseField[] = [];
  if (dataIsArray && schema.items) {
    const itemSchema = resolveSchema(schema.items, schemas);
    fields = parseSchemaFields(itemSchema, schemas);
  } else if (schema.properties) {
    fields = parseSchemaFields(schema, schemas);

    // Try to detect common data wrapper patterns
    for (const [key, prop] of Object.entries(schema.properties)) {
      const resolvedProp = resolveSchema(prop, schemas);
      if (resolvedProp.type === 'array' && ['data', 'results', 'items', 'records'].includes(key)) {
        return {
          jsonPath: key,
          dataIsArray: true,
          fields: resolvedProp.items ? parseSchemaFields(resolveSchema(resolvedProp.items, schemas), schemas) : [],
        };
      }
    }
  }

  return {
    jsonPath: '$',
    dataIsArray,
    fields,
  };
}

/**
 * Resolve $ref references in schema
 */
function resolveSchema(
  schema: SchemaObject,
  schemas?: Record<string, SchemaObject>
): SchemaObject {
  if (schema.$ref && schemas) {
    // Extract schema name from $ref (e.g., "#/components/schemas/User" -> "User")
    const refParts = schema.$ref.split('/');
    const schemaName = refParts[refParts.length - 1];
    const resolvedSchema = schemas[schemaName];
    if (resolvedSchema) {
      return resolveSchema(resolvedSchema, schemas);
    }
  }
  return schema;
}

/**
 * Parse schema properties into ResponseFields
 */
function parseSchemaFields(
  schema: SchemaObject,
  schemas?: Record<string, SchemaObject>,
  depth: number = 0
): ResponseField[] {
  if (depth > 3 || !schema.properties) return [];

  // Note: schema.required contains list of required field names, currently unused but available for future use
  // const required = schema.required || [];

  return Object.entries(schema.properties).map(([name, prop]) => {
    const resolvedProp = resolveSchema(prop, schemas);
    const field: ResponseField = {
      name,
      type: mapSchemaTypeToFieldType(resolvedProp.type),
      description: resolvedProp.description || '',
      format: resolvedProp.format,
    };

    // Parse nested fields for objects
    if (resolvedProp.type === 'object' && resolvedProp.properties) {
      field.nestedFields = parseSchemaFields(resolvedProp, schemas, depth + 1);
    }

    // Parse array item schema
    if (resolvedProp.type === 'array' && resolvedProp.items) {
      const itemSchema = resolveSchema(resolvedProp.items, schemas);
      if (itemSchema.type === 'object' && itemSchema.properties) {
        field.nestedFields = parseSchemaFields(itemSchema, schemas, depth + 1);
      }
    }

    return field;
  });
}

/**
 * Map OpenAPI schema type to ResponseField type
 */
function mapSchemaTypeToFieldType(
  schemaType?: string
): 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' {
  switch (schemaType) {
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

/**
 * Extract sample response from OpenAPI responses
 */
function extractSampleResponse(
  responses?: Record<string, ResponseObject>
): Record<string, unknown> | undefined {
  if (!responses) return undefined;

  const successResponse = responses['200'] || responses['201'];
  if (!successResponse?.content) return undefined;

  const jsonContent = successResponse.content['application/json'];
  if (!jsonContent?.example) return undefined;

  return jsonContent.example as Record<string, unknown>;
}

/**
 * Parse authentication from OpenAPI spec
 */
function parseAuthentication(spec: OpenAPISpec): AuthConfig {
  const securitySchemes = spec.components?.securitySchemes;
  if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
    return { type: 'none' };
  }

  // Get the first security scheme
  const [, scheme] = Object.entries(securitySchemes)[0];

  if (scheme.type === 'http') {
    if (scheme.scheme === 'bearer') {
      return {
        type: 'bearer',
        credentials: { token: '' },
      };
    } else if (scheme.scheme === 'basic') {
      return {
        type: 'basic',
        credentials: { username: '', password: '' },
      };
    }
  } else if (scheme.type === 'apiKey') {
    return {
      type: 'api_key',
      credentials: {
        apiKey: '',
        apiKeyHeader: scheme.name || 'X-API-Key',
        apiKeyLocation: scheme.in as 'header' | 'query' || 'header',
      },
    };
  }

  return { type: 'none' };
}

/**
 * Convert ParsedOpenAPI to partial DataAPIConfig
 */
export function parsedOpenAPIToConfig(parsed: ParsedOpenAPI): Omit<DataAPIConfig, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status' | 'categoryIds' | 'lastTested' | 'lastError'> {
  return {
    name: parsed.name,
    description: parsed.description,
    endpoint: parsed.endpoint,
    method: parsed.method,
    responseFormat: 'json',
    authentication: parsed.authentication,
    parameters: parsed.parameters,
    responseStructure: parsed.responseStructure,
    sampleResponse: parsed.sampleResponse,
    openApiSpec: parsed.originalSpec,
    configMethod: 'openapi',
  };
}
