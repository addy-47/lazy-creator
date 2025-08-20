resource "google_compute_instance" "vm" {
  project      = var.project_id
  name         = var.vm_name
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
      size  = 20
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    ssh-keys = "cloudbuild:${var.ssh_public_key}"
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -e -x

    # Install dependencies
    apt-get update
    apt-get install -y -qq docker.io docker-compose git nginx

    # Start and enable services
    systemctl enable docker
    systemctl start docker

    # Configure gcloud docker credential helper for the VM's service account
    gcloud auth configure-docker ${var.region}-docker.pkg.dev

    # Set up SSH key for the root user to clone the private GitHub repo
    mkdir -p /root/.ssh
    gcloud secrets versions access latest --secret=${var.secret_id} --project=${var.project_id} > /root/.ssh/id_rsa
    chmod 600 /root/.ssh/id_rsa
    ssh-keyscan -t rsa,ecdsa,ed25519 github.com >> /root/.ssh/known_hosts

    # Idempotently clone the repository and set ownership
    if [ ! -d "/var/www/go-blog-app/.git" ]; then
      git clone -b cloudbuild git@github.com:${var.github_repo}.git /var/www/go-blog-app
      chown -R www-data:www-data /var/www/go-blog-app
    fi
    EOF

  service_account {
    email  = var.service_account_email
    scopes = ["cloud-platform"]
  }

  tags = ["http-server", "ssh"]
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "zone" {
  description = "GCP Zone"
  type        = string
}

variable "vm_name" {
  description = "Name of the Compute Engine VM"
  type        = string
}

variable "machine_type" {
  description = "Machine type for the VM"
  type        = string
}

variable "service_account_email" {
  description = "Service account email for the VM"
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key for Cloud Build access to the VM"
  type        = string
}

variable "secret_id" {
  description = "The ID of the Secret Manager secret for the SSH private key."
  type        = string
}

variable "github_repo" {
  description = "The GitHub repository in 'owner/repo' format."
  type        = string
}

output "vm_name" { value = google_compute_instance.vm.name }

output "vm_ip" {
  value = google_compute_instance.vm.network_interface[0].access_config[0].nat_ip
}