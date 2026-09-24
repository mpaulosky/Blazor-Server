# Shared Kernel lives in a separate Domain project

The Template's building blocks that any Generated App needs (`Result`/`Result<T>` and the names the Template relies on, such as the Admin policy, the role name, and the Theme and Palette cookie names) live in their own `src/Domain` project. They don't live in `Core/Shared/`, as the Template originally planned. `Domain` references no other project and no persistence package, and both `Core` and `UI` reference it. This turns the "cross-cutting only" rule into a project boundary that `Architecture.Tests` can enforce: `Domain` depends on nothing.

Despite the name, `Domain` holds no entities, aggregates or business rules. Feature logic still lives in `Core/Features/<Feature>/`. We kept the name `Domain` so it matches the sibling Articles solution, which makes moving code and habits between the two repos easier.

## Considered Options

- **`Core/Shared/`**: the original plan. It's one project fewer, and `UI` already references `Core`. We rejected it because "keep `Shared/` small" is a convention, while a project with no references is a boundary the compiler and `Architecture.Tests` can enforce.
- **Naming it `SharedKernel`**: more accurate, but rejected to stay consistent with Articles.
- **Porting Articles' Domain wholesale (including `MongoDB.Bson`)**: rejected, because it would lock every Generated App into MongoDB.
