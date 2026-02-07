# Project Instructions

## Code Standards

### TypeScript & Type Safety (MANDATORY)

- Always use explicit types on parameters and return values
- Never use `any` type - use `unknown` with type guards
- Always use access modifiers: `private`, `protected`, `public`
- Always enable strict mode in tsconfig.json: `"strict": true`
- Always use custom error classes (AppError, ValidationError, NotFoundError)
- Always include error context and user-friendly messages

### Imports & Path Aliases

- **NEVER** use relative imports (`../../`, `../`)
- **ALWAYS** use path aliases: `@shared/*`, `@config/*`, `@models/*`
- Frontend aliases: `@app/*`, `@core/*`, `@features/*`, `@state/*`
- Backend aliases: `@modules/*`, `@infra/*`, `@database/*`
- Organize imports in 3 blocks: framework, external libraries, internal aliases

### Code Organization

- Use guard clauses for input validation (early returns)
- Extract duplicated code to services (DRY principle)
- Keep component files under 600 lines, service files under 800 lines
- Single Responsibility: one class = one reason to change
- Use Dependency Injection: `inject()` in Angular, constructor in NestJS

### Testing (MANDATORY)

- Write tests following TDD: RED -> GREEN -> REFACTOR
- Achieve 80%+ test coverage minimum
- Test both happy path and error cases
- Mock external dependencies
- Use Jest for all testing

## Frontend Architecture (Angular 20)

### Standalone Components (MANDATORY)

- Always use `standalone: true` in component decorator
- Always specify `imports: []` array with dependencies
- **NEVER** use `@NgModule` - old NgModule pattern is forbidden
- Always use `changeDetection: ChangeDetectionStrategy.OnPush`
- Always put HTML in separate `.html` files (inline templates forbidden)
- Always use barrel exports (index.ts files)

### Dependency Injection

- Always use `inject()` function: `private readonly store = inject(UserStore)`
- **NEVER** use constructor parameters (deprecated)
- Always mark injected dependencies as `private readonly`

### Signal Store State Management

- **ALWAYS** use `@ngrx/signals` for state management
- Use `@angular-architects/ngrx-toolkit` utilities
- Always include `withDevtools('storeName')` for debugging
- Always include `withCallState()` for loading/error states
- Use `withComputed()` for derived/computed state
- Use `rxMethod` for async operations with RxJS
- **NEVER** use old NgRx pattern (actions, reducers, selectors)

### Modern Control Flow

- Always use new control flow syntax: `@if`, `@else`, `@for`, `@switch`
- **NEVER** use `*ngIf`, `*ngFor`, `*ngSwitchCase`
- Always use `track` function in `@for` loops for performance
- Keep templates clean and readable

### Internationalization

- **ALWAYS** use Transloco for all user-visible text
- Translate all error messages, labels, tooltips
- Use Transloco service for dynamic translations in components
- Never hardcode text in templates

### Styling

- Use BEM (Block-Element-Modifier) methodology for CSS class names
- Use PrimeNG + PrimeFlex for enterprise UI components
- Never use nested selectors beyond 2 levels
- Scope styles to components with `styleUrl`

## Backend Architecture (NestJS)

### Module System

- Use feature modules for each domain (Users, Products, etc.)
- Always import only necessary dependencies
- Export only public services/interfaces from modules
- Prevent circular dependencies by checking import graph

### DTOs & Validation

- Always use `class-validator` decorators on DTOs
- Always apply global validation pipe at module level
- Use `@Transform` for data normalization (trim, lowercase, etc.)
- Never accept raw request bodies without validation
- Create separate DTOs for Create, Update, and Filter operations

### Entity & Database

- Always use TypeORM `@Entity` decorators
- Always use `@PrimaryGeneratedColumn('uuid')` for IDs
- Always add `@CreateDateColumn()` and `@UpdateDateColumn()`
- Always add soft delete support: `@DeleteDateColumn()`
- Always add indexes on frequently queried columns: `@Index()`
- Never use raw queries - use QueryBuilder for complex queries

### Repository Pattern

- Repository handles all database operations
- Repository only - no business logic
- Always use QueryBuilder for complex queries
- Never allow N+1 queries - use `.innerJoinAndSelect()` or `.leftJoinAndSelect()`
- Use QueryBuilder for pagination and filtering

### Services

- Services contain business logic, not repositories
- Always use dependency injection for repositories and other services
- Always validate inputs with guard clauses
- Always map entities to DTOs before returning
- Never expose sensitive data (passwords, tokens) in responses

### Controllers

- Controllers orchestrate requests, delegate to services
- Always use Swagger decorators: `@ApiTags`, `@ApiOperation`, `@ApiResponse`
- Always use guards: `@UseGuards(JwtGuard, RolesGuard)`
- Always use interceptors: `@UseInterceptors(LoggingInterceptor)`
- Always use specific HTTP status codes: `@HttpCode(HttpStatus.CREATED)`
- Always validate path parameters: `@Param('id', new ParseUUIDPipe())`

### Authentication & Security

- Use JWT with Passport strategies (jwt, refresh-token)
- Always hash passwords with bcrypt
- Always validate environment variables at startup
- Never store secrets in code - use environment variables
- Always implement graceful shutdown for Kubernetes
- Enable `app.enableShutdownHooks()` in main.ts

### Logging & Observability

- **NEVER** use `console.log` - use structured logging (nestjs-pino)
- Always include `traceId` in logs for request tracing
- Always send errors to Sentry with context
- Implement global exception filter for consistent error handling
- Log all significant events (user creation, payment processed, etc.)

### Error Handling

- Always implement global `HttpExceptionFilter`
- Map all exceptions to proper HTTP status codes
- Send errors to Sentry for monitoring
- Remove sensitive data from error responses
- Return user-friendly error messages

## Quality Standards

### Code Quality

- No `any` types - use `unknown` with type guards
- No magic values - use constants and enums
- No code duplication (DRY principle)
- No console.log - use structured logging
- No N+1 queries - audit database queries
- Guard clauses for all inputs
- Type-safe code with strict TypeScript

### Performance

- Frontend: Lighthouse score > 90
- Backend: Track query performance, no slow queries
- Use caching where appropriate
- Implement pagination for large datasets
- Lazy load modules and components
- Monitor memory usage, prevent leaks

### API Design

- Use API versioning: `/api/v1/`
- RESTful endpoint design
- Proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Consistent error response format
- Swagger documentation mandatory
- Request/response DTOs with validation

### Testing

- Unit tests: 80%+ coverage minimum
- Integration tests: happy path + error cases
- E2E tests: critical user journeys
- TDD approach: write tests first
- All tests passing before commit

### Documentation

- JSDoc for all public methods
- Type definitions complete (no `any`)
- README updated with setup instructions
- Swagger docs complete (Backend)
- Translation keys documented (Frontend)

## Pre-Commit Requirements

- All tests pass with 80%+ coverage
- No TypeScript errors
- No ESLint violations
- No `any` types
- No relative imports
- No N+1 queries (Backend)
- OnPush change detection (Frontend)
- Standalone components (Frontend)
- Error handling implemented
- Swagger docs updated (Backend)
- All text translated (Frontend)
- Guard clauses present
- No code duplication
- HTTP status codes correct

## Forbidden Patterns

- Any `any` type
- Relative imports (`../../`)
- Inline HTML templates
- `@NgModule` declarations
- Magic strings/numbers
- `console.log` in production
- Unhandled promise rejections
- Generic `Error` throws
- N+1 queries
- Circular module dependencies
- Constructor injection in Angular
- Old NgRx pattern (actions/reducers)
- Skip error handling

## Tech Stack

- **Language**: TypeScript (strict mode required)
- **Frontend**: Angular 20, Signal Store, Standalone Components
- **Backend**: NestJS, TypeORM, PostgreSQL
- **Testing**: Jest, Vitest
- **UI**: PrimeNG + PrimeFlex
- **State**: @ngrx/signals + @angular-architects/ngrx-toolkit
- **i18n**: Transloco
- **Validation**: class-validator
- **Logging**: nestjs-pino
- **Authentication**: JWT + Passport
- **Database**: PostgreSQL + TypeORM with migrations

## Development Workflow

1. **Create feature branch**: `git checkout -b feature/description`
2. **Write failing test**: RED phase
3. **Implement feature**: GREEN phase
4. **Refactor code**: REFACTOR phase
5. **Run quality checks**: Tests, linting, types
6. **Commit with message**: Clear, descriptive message
7. **Create pull request**: Wait for review
8. **Deploy**: After merge to main

## Production-Ready Standards

This codebase follows enterprise-grade standards:
- Zero tolerance for type unsafety
- Comprehensive error handling
- Full test coverage (80%+ minimum)
- Clean architecture principles
- SOLID design patterns
- Performance-optimized
- Secure by default
- Observable and maintainable
