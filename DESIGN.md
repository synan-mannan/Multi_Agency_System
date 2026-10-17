# Design

## Step 1 - Requirement Gathering

Initially i Started with gathering Requirements which were clearly mentioned in the documentation which was provided

## Step 2 - Defined the Scope of Project

Based upon gathered requirements and time Constraints i clearly defined the goal and how my end product would look like.

## Step 3 - Schema Design

I had designed the schema such that it satisfies all the requirements of roles being isolated and no-cross access of the projects and etc

### Designed Schema and Gathered Requirements

![Schema](<Requirement Gathering and Schema Design.jpeg>)

# Design Explanation -

Created a Users Table, whose purpose is to handle Authentication, and authorization is handled by respective
entities or tables

`access.py` is the shared visibility boundary. Agency admins see agency projects, members see projects they belong to, and clients see only their client's projects. Task access builds on project access and further restricts clients to client-visible tasks. Comments require a visible task and client-visible item visibility; files are project-scoped and clients only see client-visible files, even when a file is attached to an internal task. Detail helpers turn missing, cross-tenant, and hidden identifiers into the same 404.

Users are global identities with no role. A user can have a separate membership and role per agency; login returns the eligible workspaces, then workspace selection signs a token for one active membership. Every workspace request checks that membership again, immediately invalidating removed members.
