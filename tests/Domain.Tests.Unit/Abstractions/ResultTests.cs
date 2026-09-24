// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ResultTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Domain.Tests.Unit
// =============================================

using Domain.Abstractions;

namespace Domain.Tests.Unit.Abstractions;

public class ResultTests
{
	private const string ErrorMessage = "Something went wrong.";

	private static readonly object s_details = new { Version = 7 };

	[Fact]
	public void Ok_NoValue_ReturnsSuccessWithoutError()
	{
		// Arrange

		// Act
		Result result = Result.Ok();

		// Assert
		result.Success.Should().BeTrue();
		result.Failure.Should().BeFalse();
		result.Error.Should().BeNull();
		result.ErrorCode.Should().Be(ResultErrorCode.None);
		result.Details.Should().BeNull();
	}

	[Fact]
	public void OkOfT_Value_ReturnsSuccessWithValue()
	{
		// Arrange

		// Act
		Result<int> result = Result.Ok(42);

		// Assert
		result.Success.Should().BeTrue();
		result.Value.Should().Be(42);
		result.ToValue().Should().Be(42);
		result.Error.Should().BeNull();
		result.ErrorCode.Should().Be(ResultErrorCode.None);
	}

	[Fact]
	public void Fail_Message_ReturnsFailureWithMessageAndNoCode()
	{
		// Arrange

		// Act
		Result result = Result.Fail(ErrorMessage);

		// Assert
		result.Failure.Should().BeTrue();
		result.Success.Should().BeFalse();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.None);
		result.Details.Should().BeNull();
	}

	[Theory]
	[InlineData(ResultErrorCode.Concurrency)]
	[InlineData(ResultErrorCode.NotFound)]
	[InlineData(ResultErrorCode.Validation)]
	[InlineData(ResultErrorCode.Conflict)]
	[InlineData(ResultErrorCode.Unauthorized)]
	public void Fail_MessageAndCode_ReturnsFailureWithCode(ResultErrorCode code)
	{
		// Arrange

		// Act
		Result result = Result.Fail(ErrorMessage, code);

		// Assert
		result.Failure.Should().BeTrue();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(code);
		result.Details.Should().BeNull();
	}

	[Fact]
	public void Fail_MessageCodeAndDetails_ReturnsFailureWithDetails()
	{
		// Arrange

		// Act
		Result result = Result.Fail(ErrorMessage, ResultErrorCode.Concurrency, s_details);

		// Assert
		result.Failure.Should().BeTrue();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.Concurrency);
		result.Details.Should().BeSameAs(s_details);
	}

	[Fact]
	public void FailOfT_Message_ReturnsFailureWithDefaultValue()
	{
		// Arrange

		// Act
		Result<string> result = Result.Fail<string>(ErrorMessage);

		// Assert
		result.Failure.Should().BeTrue();
		result.Value.Should().BeNull();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.None);
		result.Details.Should().BeNull();
	}

	[Fact]
	public void FailOfT_MessageAndCode_ReturnsFailureWithCode()
	{
		// Arrange

		// Act
		Result<string> result = Result.Fail<string>(ErrorMessage, ResultErrorCode.NotFound);

		// Assert
		result.Failure.Should().BeTrue();
		result.Value.Should().BeNull();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.NotFound);
		result.Details.Should().BeNull();
	}

	[Fact]
	public void FailOfT_MessageCodeAndDetails_ReturnsFailureWithDetails()
	{
		// Arrange

		// Act
		Result<string> result = Result.Fail<string>(ErrorMessage, ResultErrorCode.Conflict, s_details);

		// Assert
		result.Failure.Should().BeTrue();
		result.Value.Should().BeNull();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.Conflict);
		result.Details.Should().BeSameAs(s_details);
	}

	[Fact]
	public void TypedFail_Message_ReturnsFailureWithMessageAndNoCode()
	{
		// Arrange

		// Act
		Result<string> result = Result<string>.Fail(ErrorMessage);

		// Assert
		result.Failure.Should().BeTrue();
		result.Value.Should().BeNull();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.None);
		result.Details.Should().BeNull();
	}

	[Fact]
	public void TypedFail_MessageAndCode_ReturnsFailureWithCode()
	{
		// Arrange

		// Act
		Result<string> result = Result<string>.Fail(ErrorMessage, ResultErrorCode.Unauthorized);

		// Assert
		result.Failure.Should().BeTrue();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.Unauthorized);
		result.Details.Should().BeNull();
	}

	[Fact]
	public void TypedFail_MessageCodeAndDetails_ReturnsFailureWithDetails()
	{
		// Arrange

		// Act
		Result<string> result = Result<string>.Fail(ErrorMessage, ResultErrorCode.Validation, s_details);

		// Assert
		result.Failure.Should().BeTrue();
		result.Error.Should().Be(ErrorMessage);
		result.ErrorCode.Should().Be(ResultErrorCode.Validation);
		result.Details.Should().BeSameAs(s_details);
	}

	[Fact]
	public void FromValue_NonNullValue_ReturnsSuccessWithValue()
	{
		// Arrange

		// Act
		Result<string> result = Result.FromValue("value");

		// Assert
		result.Success.Should().BeTrue();
		result.Value.Should().Be("value");
	}

	[Fact]
	public void TypedFromValue_NonNullValue_ReturnsSuccessWithValue()
	{
		// Arrange

		// Act
		Result<string> result = Result<string>.FromValue("value");

		// Assert
		result.Success.Should().BeTrue();
		result.Value.Should().Be("value");
	}

	[Fact]
	public void ImplicitConversion_NonNullValue_ReturnsSuccessWithValue()
	{
		// Arrange
		const string value = "value";

		// Act
		Result<string> result = value;

		// Assert
		result.Success.Should().BeTrue();
		result.Value.Should().Be(value);
	}

	[Fact]
	public void ImplicitConversion_NullValue_ReturnsFailure()
	{
		// Arrange
		string? value = null;

		// Act
		Result<string> result = value;

		// Assert
		result.Failure.Should().BeTrue();
		result.Value.Should().BeNull();
	}
}
