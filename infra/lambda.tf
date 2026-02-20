data "archive_file" "backend_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/backend.zip"
}

resource "aws_lambda_function" "backend" {
  function_name = "${var.project_name}-${var.environment}-backend"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs22.x"
  handler       = "src/lambda.handler"

  filename         = data.archive_file.backend_zip.output_path
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      JWT_SECRET  = data.aws_ssm_parameter.jwt_secret.value
      MONGODB_URI = data.aws_ssm_parameter.mongodb_uri.value
    }
  }
}

output "lambda_arn" {
  description = "Lambda ARN for backend handler."
  value       = aws_lambda_function.backend.arn
}
