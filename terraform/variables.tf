variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  description = "GCP Region"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "vm_name" {
  type    = string
  default = "lazycreator"
}

variable "machine_type" {
  type    = string
  default = "e2-micro"
}

variable "sa_email" {
  type        = string
  description = "Service Account email to attach to the VM"
}

variable "ssh_username" {
  type    = string
  default = "addy"
}

variable "public_ingress_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}