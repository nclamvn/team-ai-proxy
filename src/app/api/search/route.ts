import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/db';
import { search, SearchResult } from '@/lib/knowledge/search';

// Types
interface SearchRequest {
  query: string;
  mode?: 'hybrid' | 'semantic' | 'keyword';
  filters?: {
    tag?: string;
    userId?: string;
    visibility?: 'team' | 'private' | 'all';
    limit?: number;
  };
}

interface SearchResponse {
  results: SearchResult[];
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: string
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SearchResponse | ErrorResponse>> {
  try {
    // 1. Authenticate user
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return errorResponse(
        'UNAUTHORIZED',
        'Authentication required. Please provide user credentials.',
        401
      );
    }

    if (!isValidUUID(userId)) {
      return errorResponse(
        'INVALID_USER_ID',
        'Invalid user ID format.',
        401
      );
    }

    // Verify user exists
    const user = await getUserById(userId);
    if (!user) {
      return errorResponse(
        'USER_NOT_FOUND',
        'User not found. Please check your credentials.',
        401
      );
    }

    // 2. Parse and validate request body
    let body: SearchRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        'INVALID_JSON',
        'Request body must be valid JSON.',
        400
      );
    }

    // Validate query
    if (!body.query || typeof body.query !== 'string') {
      return errorResponse(
        'MISSING_QUERY',
        'Query is required and must be a string.',
        400
      );
    }

    const trimmedQuery = body.query.trim();
    if (trimmedQuery.length === 0) {
      return errorResponse(
        'EMPTY_QUERY',
        'Query cannot be empty.',
        400
      );
    }

    // Validate mode
    const validModes = ['hybrid', 'semantic', 'keyword'];
    const mode = body.mode || 'hybrid';
    if (!validModes.includes(mode)) {
      return errorResponse(
        'INVALID_MODE',
        `Mode must be one of: ${validModes.join(', ')}`,
        400
      );
    }

    // Validate filters
    const filters = body.filters || {};
    if (filters.userId && !isValidUUID(filters.userId)) {
      return errorResponse(
        'INVALID_FILTER_USER_ID',
        'Filter userId must be a valid UUID.',
        400
      );
    }

    if (filters.visibility) {
      const validVisibilities = ['team', 'private', 'all'];
      if (!validVisibilities.includes(filters.visibility)) {
        return errorResponse(
          'INVALID_VISIBILITY',
          `Visibility must be one of: ${validVisibilities.join(', ')}`,
          400
        );
      }
    }

    if (filters.limit !== undefined) {
      if (typeof filters.limit !== 'number' || filters.limit < 1 || filters.limit > 100) {
        return errorResponse(
          'INVALID_LIMIT',
          'Limit must be a number between 1 and 100.',
          400
        );
      }
    }

    // 3. Execute search
    const results = await search(
      trimmedQuery,
      mode as 'hybrid' | 'semantic' | 'keyword',
      {
        tag: filters.tag,
        userId: filters.userId,
        visibility: filters.visibility,
        limit: filters.limit,
      }
    );

    // 4. Return response
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search API error:', error instanceof Error ? error.message : 'Unknown error');

    return errorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred during search.',
      500
    );
  }
}
