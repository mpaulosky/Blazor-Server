// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     GlobalSuppressions.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;

[assembly: SuppressMessage(
	"Naming",
	"CA1716:Identifiers should not match keywords",
	Justification = "docs/plans/ui-restyle.md names this namespace UI.Components.Shared; renaming it to dodge the reserved word 'Shared' would break the spec it implements.",
	Scope = "namespace",
	Target = "~N:UI.Components.Shared")]
