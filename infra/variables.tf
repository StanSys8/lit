variable "project_name" {
  description = "Project identifier used for naming conventions."
  type        = string
  default     = "lit"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for deployment resources."
  type        = string
  default     = "eu-central-1"
}

variable "ssm_parameter_prefix" {
  description = "Prefix for runtime secrets in SSM Parameter Store."
  type        = string
  default     = "/lit"
}
