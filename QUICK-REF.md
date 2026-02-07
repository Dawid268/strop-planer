# Quick Reference - Cursor Rules Cheatsheet

## Dla: Full-Stack Developer (Angular 20 + NestJS)

---

## Przed kazdym promptem

1. Czy to Angular czy NestJS?
2. Czy mam valid types?
3. Czy bede testowac?
4. Czy przetlumacze text? (Angular)
5. Czy dodam error handling?

---

## Absolute Rules (NIE LAMAC)

| NEVER | INSTEAD |
|-------|---------|
| `const x: any` | `const x: MyType` lub `unknown` |
| `import from '../../'` | `import from '@shared/module'` |
| `template: '<div>'` | `templateUrl: './x.html'` |
| `@NgModule` | `standalone: true` |
| `console.log()` | `inject(Logger)` |
| `throw new Error()` | `throw new AppError()` |
| Constructor params | `private store = inject(Store)` |
| `ngIf`, `ngFor` | `@if`, `@for` |
| `async` in component | Use Signal Store |
| No error handling | Try/catch + error state |

---

## Checklist - Co Generowac

### Kazdy Component (Angular)

- standalone: true
- imports: []
- OnPush change detection
- separate .html file
- @Input/@Output defined
- private readonly store = inject()
- No console.log
- Error handling
- i18n: transloco
- BEM CSS classes

### Kazdy Service (Angular)

- private readonly repo = inject()
- Error handling (guard clauses)
- Typed return values
- No API calls (use Store)
- Pure business logic
- Testable (90%+ coverage)
- JSDoc comments

### Kazdy Controller (NestJS)

- @ApiTags, @ApiOperation
- @UseGuards(JwtGuard, RolesGuard)
- @UseInterceptors, @UseFilters
- @HttpCode(HttpStatus.X)
- @Param('id', ParseUUIDPipe)
- Swagger @ApiResponse
- Error handling
- Access modifiers (public/private)

### Kazdy Service (NestJS)

- Guard clauses first (validate input)
- DTO validation
- Error handling (AppError classes)
- Inject repository
- Remove sensitive data
- Map entity to DTO
- No console.log
- Typed return values

### Kazdy DTO (NestJS)

- @IsEmail/@IsString/@IsEnum
- @MinLength/@MaxLength
- @Transform() for normalization
- @IsOptional for optional fields
- Error messages
- No business logic
- Type-safe

### Kazdy Entity (NestJS)

- @Entity('table_name')
- @PrimaryGeneratedColumn('uuid')
- @Index() on frequent columns
- @CreateDateColumn()
- @UpdateDateColumn()
- @DeleteDateColumn() for soft delete
- @Unique() for unique fields
- Getter methods for computed props

---

## File Sizes

| Type | Max Lines |
|------|-----------|
| Component .ts | 600 |
| Service .ts | 800 |
| Entity .ts | 300 |
| DTO .ts | 200 |
| Controller .ts | 400 |
| Store .ts | 600 |

If larger - **split into smaller focused classes**

---

## Test Template

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UsersRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
    } as any;
    service = new UserService(mockRepository);
  });

  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      // Arrange
      const dto: CreateUserDto = { email: 'test@example.com', password: 'Test123!' };
      mockRepository.create.mockResolvedValue({ id: '1', ...dto, password: 'hashed' });

      // Act
      const result = await service.createUser(dto);

      // Assert
      expect(mockRepository.create).toHaveBeenCalled();
      expect(result.password).not.toBe(dto.password);
    });

    it('should throw on invalid email', async () => {
      // Arrange
      const dto = { email: 'invalid', password: 'Test123!' } as any;

      // Act & Assert
      await expect(service.createUser(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
```

---

## Git Commit Messages

```bash
# Feature
git commit -m "feat: add user authentication with JWT"

# Fix
git commit -m "fix: prevent N+1 query in users endpoint"

# Docs
git commit -m "docs: add cursor rules for team"

# Refactor
git commit -m "refactor: extract password hashing to service"

# Tests
git commit -m "test: add 90%+ coverage for UserService"
```

---

## Validation Checklist Before Commit

```bash
# Run these before commit:

npm run test         # 80%+ coverage
npm run lint         # ESLint pass
npm run type-check   # TypeScript strict
npm run build        # Build succeeds

# Frontend only:
npm run lighthouse   # > 90

# Backend only:
npm run typeorm migration:generate
npm run e2e          # E2E tests pass
```

---

## Common Questions

**Q: Moge uzyc `any` dla szybkosci?**
A: NIGDY. Jesli szybkosc jest ograniczona - pytaj @cursor o typ.

**Q: Moge uzyc `console.log` do debugowania?**
A: NIGDY. Uzywaj `inject(Logger)` (Angular) lub `nestjs-pino` (NestJS).

**Q: Moge pominac testy?**
A: NIGDY. TDD: piszesz test PRZED kodem. 80%+ coverage obowiazkowe.

**Q: Moge uzyc NgModule zamiast standalone?**
A: NIGDY. Angular 20 = tylko standalone components.

**Q: Moge nie obslugiwac error'ow?**
A: NIGDY. Kazda funkcja musi obslugiwac bledy.

**Q: Moge uzyc `any` w testach?**
A: TAK, ale `as any` zamiast typu. Minimalizuj.

**Q: Moge uzyc relative imports?**
A: NIGDY. ZAWSZE path aliases.

---

**Version:** 4.0 Enterprise Grade
**Status:** Production-Ready
