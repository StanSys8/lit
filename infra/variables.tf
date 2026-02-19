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
  description = "AWS region for future resources."
  type        = string
  default     = "us-east-1"
}
