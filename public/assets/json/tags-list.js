$(document).ready(function () {

    if ($("#tags_list").length > 0) {
		$("#tags_list").DataTable({
			bFilter: false,
			bInfo: false,
			"ordering": true,
			"autoWidth": true,
			"language": {
				search: ' ',
				sLengthMenu: '_MENU_',
				searchPlaceholder: "Search",
				info: "_START_ - _END_ of _TOTAL_ items",
				"lengthMenu": "Show _MENU_ entries",
				paginate: {
					next: '<i class="ti ti-chevron-right"></i> ',
					previous: '<i class="ti ti-chevron-left"></i> '
				},
			},
			initComplete: function(settings, json) {
				$('.dataTables_paginate').appendTo('.datatable-paginate');
				$('.dataTables_length').appendTo('.datatable-length');
			},
			"data": [
			{
				"id": 1,
				"title": "Productivity",
				"created_date": "17 Dec 2025",
				"status": "0"
			},
			{
				"id": 2,
				"title": "Integration",
				"created_date": "11 Dec 2025",
				"status": "0"
			},
			{
				"id": 3,
				"title": "Integration",
				"created_date": "23 Nov 2025",
				"status": "0"
			},
			{
				"id": 4,
				"title": "Security",
				"created_date": "12 Nov 2025",
				"status": "0"
			},
			{
				"id": 5,
				"title": "Data Insights",
				"created_date": "07 Nov 2025",
				"status": "0"
			},
			{
				"id": 6,
				"title": "Automation",
				"created_date": "15 Oct 2025",
				"status": "1"
			},
			{
				"id": 7,
				"title": "Marketing",
				"created_date": "04 Oct 2025",
				"status": "1"
			},
			{
				"id": 8,
				"title": "Marketing",
				"created_date": "29 Sep 2025",
				"status": "0"
			},
			{
				"id": 9,
				"title": "User Training",
				"created_date": "25 Sep 2025",
				"status": "1"
			},
			{
				"id": 10,
				"title": "Security",
				"created_date": "17 Sep 2025",
				"status": "0"
			}
			],
			columns: [
			{
				"render": function (data, type, row) {
						return '<div class="form-check form-check-md"><input class="form-check-input" type="checkbox"></div>';
				}
			},
			{ "render": function ( data, type, row ){
				return '<span class="title-name">'+row['title']+'</span>';
			}},
			{ data: "created_date" },
			{
				render: function (data, type, row) {
				if (row["status"] == "1") {
					var class_name = "bg-success";
					var status_name = "Active";
				}
				if (row["status"] == "0") {
					var class_name = "bg-success";
					var status_name = "Active";
				} else {
					var class_name = "bg-danger";
					var status_name = "Inactive";
				}
				return (
					'<span class="badge badge-pill badge-status ' +
					class_name +
					'" >' +
					status_name +
					"</span>"
				);
				},
			},

			{
					"render": function (data, type, row) {
						return '<div class="dropdown table-action"><a href="#" class="action-icon btn btn-xs shadow d-inline-flex btn-outline-light" data-bs-toggle="dropdown" aria-expanded="false"><i class="ti ti-dots-vertical"></i></a><div class="dropdown-menu dropdown-menu-right"><a class="dropdown-item" href="javascript:void(0);" data-bs-toggle="modal" data-bs-target="#edit_tags"><i class="ti ti-edit text-blue"></i> Edit</a><a class="dropdown-item" href="#" data-bs-toggle="modal" data-bs-target="#delete_tags"><i class="ti ti-trash"></i> Delete</a></div></div>';
					}
				}
			],
		});
	}

}); 