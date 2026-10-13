// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     GreetingNameTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using System.Security.Claims;

using UI.Components.Features.Authentication;

namespace UI.Tests.Unit.Components.Features.Authentication;

public class GreetingNameTests
{
	[Theory]
	[InlineData("Jane Doe", "Janie", "jane@example.com", "Jane Doe")]
	[InlineData(null, "Janie", "jane@example.com", "Janie")]
	[InlineData(null, null, "jane@example.com", "jane@example.com")]
	[InlineData("", "", "jane@example.com", "jane@example.com")]
	[InlineData("   ", "Janie", "jane@example.com", "Janie")]
	public void For_User_ReturnsFirstNonEmptyOfNameNicknameAndEmail(string? name, string? nickname, string? email,
		string expected)
	{
		// Arrange
		ClaimsPrincipal user = CreateUser(
			(GreetingName.NameClaimType, name),
			(GreetingName.NicknameClaimType, nickname),
			(GreetingName.EmailClaimType, email));

		// Act
		string? result = GreetingName.For(user);

		// Assert
		result.Should().Be(expected);
	}

	[Fact]
	public void For_EmailMappedToClaimTypesEmail_ReturnsEmail()
	{
		// Arrange
		ClaimsPrincipal user = CreateUser((ClaimTypes.Email, "jane@example.com"));

		// Act
		string? result = GreetingName.For(user);

		// Assert
		result.Should().Be("jane@example.com");
	}

	[Theory]
	[InlineData(null)]
	[InlineData(" ")]
	public void For_UserWithoutAnyGreetingClaim_ReturnsNull(string? name)
	{
		// Arrange
		ClaimsPrincipal user = CreateUser((GreetingName.NameClaimType, name), (ClaimTypes.Name, "test-user"));

		// Act
		string? result = GreetingName.For(user);

		// Assert
		result.Should().BeNull();
	}

	[Fact]
	public void For_Visitor_ReturnsNull()
	{
		// Arrange
		ClaimsPrincipal visitor = new(new ClaimsIdentity([new Claim(GreetingName.NameClaimType, "Jane Doe")]));

		// Act
		string? result = GreetingName.For(visitor);

		// Assert
		result.Should().BeNull();
	}

	[Fact]
	public void For_NameContainsHtml_ReturnsItUnchanged()
	{
		// Arrange
		ClaimsPrincipal user = CreateUser((GreetingName.NameClaimType, "<b>Jane</b>"));

		// Act
		string? result = GreetingName.For(user);

		// Assert
		result.Should().Be("<b>Jane</b>");
	}

	// A null value leaves that claim off the User. The Where drops those, so the Select never sees a null Value.
	private static ClaimsPrincipal CreateUser(params (string Type, string? Value)[] claims) =>
		new(new ClaimsIdentity(
			claims.Where(claim => claim.Value is not null).Select(claim => new Claim(claim.Type, claim.Value!)),
			"Test"));
}
