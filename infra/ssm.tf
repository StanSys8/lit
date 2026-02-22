data "aws_ssm_parameter" "jwt_secret" {
  name            = "${var.ssm_parameter_prefix}/jwt-secret"
  with_decryption = true
}

data "aws_ssm_parameter" "mongodb_uri" {
  name            = "${var.ssm_parameter_prefix}/mongodb-uri"
  with_decryption = true
}

data "aws_ssm_parameter" "cors_origin" {
  name            = "${var.ssm_parameter_prefix}/cors-origin"
  with_decryption = true
}

data "aws_ssm_parameter" "email_from" {
  name            = "${var.ssm_parameter_prefix}/email-from"
  with_decryption = true
}

data "aws_ssm_parameter" "app_base_url" {
  name            = "${var.ssm_parameter_prefix}/app-base-url"
  with_decryption = true
}
